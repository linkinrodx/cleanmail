import type { ImapFlow } from "imapflow";
import type { GroupEmailsParams, SenderGroup } from "../shared/rpc-types";
import { debugLog } from "./debug";
import { recommendAction } from "./heuristics";
import { createImapClient, ENVELOPE_FETCH_BATCH } from "./imap";
import { getAccountById } from "./storage";

/**
 * Scan a mailbox window once and group messages by exact sender address.
 *
 * This is the batched-envelope-only path (no per-sender `SEARCH FROM` burst)
 * that powers the Suggestions feature. It is intentionally safe to run inside
 * the background job: a single `SEARCH ALL` plus bounded FETCH batches, which
 * Outlook/Office365 never close the socket on.
 */
export async function scanGroups(
	opts: GroupEmailsParams,
	onProgress?: (p: {
		phase: "search" | "envelopes" | "done";
		scanned: number;
		total: number;
		sendersFound: number;
	}) => void,
	shouldCancel?: () => boolean,
): Promise<{ groups: SenderGroup[]; error?: string; cancelled?: boolean }> {
	const {
		accountId,
		mailboxPath,
		minCount = 5,
		limit = 100,
		scanCap = 0,
	} = opts;

	const account = await getAccountById(accountId);
	if (!account) {
		return { groups: [], error: "Account not found" };
	}

	let client: ImapFlow | undefined;
	const startedAt = Date.now();
	let cancelled = false;

	try {
		client = await createImapClient(account);
		await client.connect();

		const lock = await client.getMailboxLock(mailboxPath);
		const bySender = new Map<
			string,
			{ count: number; dates: number[]; subjects: string[] }
		>();

		try {
			const allUids = (await client.search(
				{ all: true },
				{ uid: true },
			)) as number[];
			onProgress?.({
				phase: "search",
				scanned: 0,
				total: allUids.length,
				sendersFound: 0,
			});
			// `scanCap <= 0` means "unlimited — scan every UID".
			const uids =
				scanCap > 0 && allUids.length > scanCap
					? allUids.slice(allUids.length - scanCap)
					: allUids;
			debugLog(
				`[groups] search ${Date.now() - startedAt}ms mailbox=${mailboxPath} total=${allUids.length} scan=${uids.length}`,
			);

			if (uids.length > 0) {
				// Fetch envelopes in bounded batches: a single FETCH of thousands
				// of UIDs makes Outlook/Office365 reject the command.
				for (let i = 0; i < uids.length; i += ENVELOPE_FETCH_BATCH) {
					if (shouldCancel?.()) {
						cancelled = true;
						break;
					}
					const batch = uids.slice(i, i + ENVELOPE_FETCH_BATCH);
					for await (const msg of client.fetch(
						{ uid: batch.join(",") },
						{ uid: true, envelope: true },
						{ uid: true },
					)) {
						const addr = (msg.envelope?.from?.[0]?.address ?? "").toLowerCase();
						if (!addr) {
							continue;
						}
						const entry = bySender.get(addr) ?? {
							count: 0,
							dates: [],
							subjects: [],
						};
						entry.count += 1;
						const date = msg.envelope?.date;
						if (date) {
							entry.dates.push(date.getTime());
						}
						const subject = msg.envelope?.subject;
						if (subject) {
							entry.subjects.push(subject);
						}
						bySender.set(addr, entry);
					}
					onProgress?.({
						phase: "envelopes",
						scanned: i + batch.length,
						total: uids.length,
						sendersFound: bySender.size,
					});
				}
			}
			debugLog(
				`[groups] fetch ${Date.now() - startedAt}ms senders=${bySender.size}`,
			);
		} finally {
			lock.release();
		}

		if (cancelled) {
			await client.logout();
			return { groups: [], cancelled: true };
		}

		// Counts are exact within the scanned window — no full-mailbox SEARCH
		// second pass (that per-sender `search({ from })` burst is what broke
		// Outlook with "Connection not available").
		const groups = [...bySender.entries()]
			.map(([authorEmail, entry]) => ({
				authorEmail,
				count: entry.count,
				lastDate:
					entry.dates.length > 0
						? new Date(Math.max(...entry.dates)).toISOString()
						: new Date(0).toISOString(),
				sampleSubjects: entry.subjects.slice(-3).reverse(),
			}))
			.filter((g) => g.count >= minCount)
			.sort((a, b) => b.count - a.count)
			.slice(0, limit)
			.map(
				(g): SenderGroup => ({
					...g,
					recommendedAction: recommendAction(g),
				}),
			);

		await client.logout();
		return { groups };
	} catch (err) {
		const e = err as { responseStatus?: string; responseText?: string };
		const base = err instanceof Error ? err.message : String(err);
		const detail = [base, e.responseStatus, e.responseText]
			.filter((v): v is string => Boolean(v))
			.join(" — ");
		try {
			await client?.logout();
		} catch {
			// ignore logout errors
		}
		return { groups: [], error: detail };
	}
}
