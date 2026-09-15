import type {
	GroupEmailsParams,
	GroupScanProgress,
	GroupScanStatus,
	SenderGroup,
} from "../shared/rpc-types";
import { debugLog } from "./debug";
import { scanGroups } from "./groups";
import { readSuggestionCache, writeSuggestionCache } from "./storage";

/** Cache is served as-is when it is at most this old. */
const SUGGESTION_FRESH_MS = 10 * 60 * 1000;

/** Safety net: request cancel if a scan runs far longer than expected. */
const SCAN_WATCHDOG_MS = 5 * 60 * 1000;

/** The subset of a scan progress frame we retain for the terminal push. */
type ScanProgressBase = Pick<
	GroupScanProgress,
	"phase" | "scanned" | "total" | "sendersFound"
>;

const running = new Set<string>();

const runningKey = (accountId: string, mailboxPath: string) =>
	`${accountId}:${mailboxPath}`;

const isFreshCache = (cachedAt: string): boolean => {
	const parsed = Date.parse(cachedAt);
	if (Number.isNaN(parsed)) {
		return false;
	}
	return Date.now() - parsed <= SUGGESTION_FRESH_MS;
};

let notifier: (p: GroupScanProgress) => void = () => {};

export function setScanNotifier(fn: (p: GroupScanProgress) => void) {
	notifier = fn;
}

/** Push a progress frame without letting a webview hiccup abort the scan. */
function safeNotify(p: GroupScanProgress): void {
	try {
		notifier(p);
	} catch {
		// webview may not be ready yet — drop this frame
	}
}

const cancelled = new Set<string>();

/**
 * Ask a running suggestions scan to stop. The scan checks this between envelope
 * batches and aborts without caching partial results. Safe: the scan is
 * read-only, so cancelling never modifies mail.
 */
export function rpcCancelGroupScan({
	accountId,
	mailboxPath,
}: {
	accountId: string;
	mailboxPath: string;
}): { cancelled: boolean } {
	const key = runningKey(accountId, mailboxPath);
	if (!running.has(key)) {
		// Nothing is scanning; don't leave a stale cancel flag behind.
		return { cancelled: false };
	}
	cancelled.add(key);
	return { cancelled: true };
}

/**
 * Resolve the current suggestions state for an account+mailbox without
 * starting any work: serves the persisted cache when present, otherwise
 * reports whether a scan is already running. Never throws.
 */
export async function rpcGetSuggestions({
	accountId,
	mailboxPath,
}: {
	accountId: string;
	mailboxPath: string;
}): Promise<{
	groups: SenderGroup[];
	status: GroupScanStatus;
	cachedAt: string | null;
	error?: string;
}> {
	try {
		const cached = await readSuggestionCache(accountId, mailboxPath);
		if (cached) {
			return {
				groups: cached.groups,
				status: "ready",
				cachedAt: cached.cachedAt,
			};
		}
		return {
			groups: [],
			status: running.has(runningKey(accountId, mailboxPath))
				? "scanning"
				: "idle",
			cachedAt: null,
		};
	} catch (err) {
		return {
			groups: [],
			status: "idle",
			cachedAt: null,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Drop a single sender from the persisted suggestion cache. Called after a bulk
 * action (archive/trash/delete/mark-read) removes that sender's messages, so
 * the suggestion disappears from the list without waiting for a full re-scan.
 */
export async function rpcInvalidateSuggestion({
	accountId,
	mailboxPath,
	authorEmail,
}: {
	accountId: string;
	mailboxPath: string;
	authorEmail: string;
}): Promise<{ success: boolean; error?: string }> {
	try {
		const cached = await readSuggestionCache(accountId, mailboxPath);
		if (!cached) {
			return { success: true };
		}
		const target = authorEmail.toLowerCase();
		const filtered = cached.groups.filter(
			(g) => g.authorEmail.toLowerCase() !== target,
		);
		if (filtered.length === cached.groups.length) {
			return { success: true };
		}
		await writeSuggestionCache(accountId, mailboxPath, filtered);
		return { success: true };
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Kick off a background suggestions scan (or serve a fresh cache). Returns
 * immediately; progress/completion is pushed via `groupScanProgress`.
 */
export async function rpcStartGroupScan({
	accountId,
	mailboxPath,
	force,
}: {
	accountId: string;
	mailboxPath: string;
	force?: boolean;
}): Promise<{ started: boolean; alreadyRunning?: boolean; error?: string }> {
	const key = runningKey(accountId, mailboxPath);

	if (running.has(key)) {
		return { started: false, alreadyRunning: true };
	}

	if (!force) {
		try {
			const cached = await readSuggestionCache(accountId, mailboxPath);
			if (cached && isFreshCache(cached.cachedAt)) {
				safeNotify({
					accountId,
					mailboxPath,
					status: "ready",
					phase: "done",
					scanned: 0,
					total: 0,
					sendersFound: 0,
					groups: cached.groups,
					cachedAt: cached.cachedAt,
				});
				return { started: false };
			}
		} catch {
			// a broken cache read is not fatal — fall through and scan
		}
	}

	running.add(key);
	cancelled.delete(key);

	// Fire-and-forget: never await this from the RPC handler.
	void (async () => {
		// If the scan stalls (e.g. a wedged socket never resolves), flip the
		// cancel flag so it unwinds at its next batch boundary instead of
		// hanging `running` forever.
		const watchdog = setTimeout(() => {
			if (running.has(key)) {
				debugLog(
					`[groups] scan watchdog elapsed for ${key}; requesting cancel`,
				);
				cancelled.add(key);
			}
		}, SCAN_WATCHDOG_MS);

		let lastProgress: ScanProgressBase = {
			phase: "search",
			scanned: 0,
			total: 0,
			sendersFound: 0,
		};
		try {
			safeNotify({
				accountId,
				mailboxPath,
				status: "scanning",
				phase: "search",
				scanned: 0,
				total: 0,
				sendersFound: 0,
			});

			const params: GroupEmailsParams = { accountId, mailboxPath };
			const result = await scanGroups(
				params,
				(p) => {
					lastProgress = p;
					safeNotify({ ...p, status: "scanning", accountId, mailboxPath });
				},
				() => cancelled.has(key),
			);

			if (result.cancelled) {
				safeNotify({
					accountId,
					mailboxPath,
					status: "idle",
					phase: "done",
					scanned: 0,
					total: 0,
					sendersFound: 0,
					groups: [],
				});
				return;
			}

			if (result.error) {
				safeNotify({
					accountId,
					mailboxPath,
					status: "error",
					phase: "done",
					scanned: lastProgress.scanned,
					total: lastProgress.total,
					sendersFound: lastProgress.sendersFound,
					error: result.error,
				});
				return;
			}

			let cachedAt: string | undefined;
			try {
				cachedAt = await writeSuggestionCache(
					accountId,
					mailboxPath,
					result.groups,
				);
			} catch (err) {
				debugLog(
					`[groups] cache write failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
			safeNotify({
				accountId,
				mailboxPath,
				status: "ready",
				phase: "done",
				scanned: lastProgress.scanned,
				total: lastProgress.total,
				sendersFound: lastProgress.sendersFound,
				groups: result.groups,
				cachedAt,
			});
		} catch (err) {
			safeNotify({
				accountId,
				mailboxPath,
				status: "error",
				phase: "done",
				scanned: lastProgress.scanned,
				total: lastProgress.total,
				sendersFound: lastProgress.sendersFound,
				error: err instanceof Error ? err.message : String(err),
			});
		} finally {
			clearTimeout(watchdog);
			running.delete(key);
			cancelled.delete(key);
		}
	})();

	return { started: true };
}
