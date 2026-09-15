import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import keytar from "keytar";
import type {
	Account,
	PersistedAction,
	SenderGroup,
} from "../shared/rpc-types";

const APP_NAME = "cleanmail";

const getAppDataDir = (): string => {
	const platform = process.platform;
	const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";

	if (platform === "linux") {
		const xdgDataHome =
			process.env.XDG_DATA_HOME ?? join(home, ".local", "share");
		return join(xdgDataHome, APP_NAME);
	}
	if (platform === "darwin") {
		return join(home, "Library", "Application Support", APP_NAME);
	}
	const appData = process.env.APPDATA ?? join(home, "AppData", "Roaming");
	return join(appData, APP_NAME);
};

const APP_DATA_DIR = getAppDataDir();
const ACTIONS_FILE = join(APP_DATA_DIR, "actions.json");
const ACCOUNTS_FILE = join(APP_DATA_DIR, "accounts.json");
const SUGGESTIONS_FILE = join(APP_DATA_DIR, "suggestions.json");

type SuggestionCacheEntry = {
	groups: SenderGroup[];
	cachedAt: string;
};

const suggestionCacheKey = (accountId: string, mailboxPath: string) =>
	`${accountId}:${mailboxPath}`;

const LEGACY_KEYTAR_SERVICE = "cleanmail";
const LEGACY_KEYTAR_CONFIG = "imap-config";
const LEGACY_KEYTAR_PASSWORD = "imap-password";

export async function readActions(): Promise<PersistedAction[]> {
	try {
		const file = Bun.file(ACTIONS_FILE);
		const exists = await file.exists();
		if (!exists) {
			return [];
		}

		const content = await file.json();
		return content as PersistedAction[];
	} catch {
		return [];
	}
}

export async function writeActions(actions: PersistedAction[]): Promise<void> {
	await mkdir(APP_DATA_DIR, { recursive: true });
	await Bun.write(ACTIONS_FILE, JSON.stringify(actions, null, 2));
}

/**
 * Read the persisted suggestions cache for one account+mailbox.
 * Missing or corrupt cache files resolve to `null` (never throw).
 */
export async function readSuggestionCache(
	accountId: string,
	mailboxPath: string,
): Promise<SuggestionCacheEntry | null> {
	try {
		const file = Bun.file(SUGGESTIONS_FILE);
		const exists = await file.exists();
		if (!exists) {
			return null;
		}
		const content = await file.json();
		const map = content as Record<string, SuggestionCacheEntry>;
		return map[suggestionCacheKey(accountId, mailboxPath)] ?? null;
	} catch {
		return null;
	}
}

/**
 * Persist a suggestions scan result for one account+mailbox (read-modify-write
 * on a shared map). Returns the ISO timestamp that was stored.
 */
export async function writeSuggestionCache(
	accountId: string,
	mailboxPath: string,
	groups: SenderGroup[],
): Promise<string> {
	await mkdir(APP_DATA_DIR, { recursive: true });

	let map: Record<string, SuggestionCacheEntry> = {};
	try {
		const file = Bun.file(SUGGESTIONS_FILE);
		const exists = await file.exists();
		if (exists) {
			const content = await file.json();
			if (content && typeof content === "object") {
				map = content as Record<string, SuggestionCacheEntry>;
			}
		}
	} catch {
		// corrupt/partial write — start a fresh map
	}

	const cachedAt = new Date().toISOString();
	map[suggestionCacheKey(accountId, mailboxPath)] = { groups, cachedAt };
	await Bun.write(SUGGESTIONS_FILE, JSON.stringify(map, null, 2));
	return cachedAt;
}

/**
 * Remove a single sender from the persisted suggestion cache for a mailbox.
 * Called after a bulk action completes so a cleared sender never reappears on
 * the next load, independent of what the renderer is currently showing.
 */
export async function removeSenderFromSuggestionCache(
	accountId: string,
	mailboxPath: string,
	authorEmail: string,
): Promise<void> {
	try {
		const entry = await readSuggestionCache(accountId, mailboxPath);
		if (!entry) {
			return;
		}
		const target = authorEmail.toLowerCase();
		const filtered = entry.groups.filter(
			(g) => g.authorEmail.toLowerCase() !== target,
		);
		if (filtered.length === entry.groups.length) {
			return;
		}
		await writeSuggestionCache(accountId, mailboxPath, filtered);
	} catch {
		// best-effort cache cleanup; never break a job over it
	}
}

export async function readAccounts(): Promise<Account[]> {
	try {
		const file = Bun.file(ACCOUNTS_FILE);
		const exists = await file.exists();
		if (!exists) {
			return await migrateLegacyConfig();
		}

		const content = await file.json();
		return content as Account[];
	} catch {
		return [];
	}
}

async function migrateLegacyConfig(): Promise<Account[]> {
	try {
		const legacyConfigJson = await keytar.getPassword(
			LEGACY_KEYTAR_SERVICE,
			LEGACY_KEYTAR_CONFIG,
		);
		const legacyPassword = await keytar.getPassword(
			LEGACY_KEYTAR_SERVICE,
			LEGACY_KEYTAR_PASSWORD,
		);

		if (!legacyConfigJson || !legacyPassword) {
			return [];
		}

		const legacyConfig = JSON.parse(legacyConfigJson) as {
			host: string;
			port: number;
			username: string;
		};

		const account: Account = {
			id: crypto.randomUUID(),
			provider: "custom",
			email: legacyConfig.username,
			host: legacyConfig.host,
			port: legacyConfig.port,
			authMethod: "password",
		};

		await keytar.setPassword(
			LEGACY_KEYTAR_SERVICE,
			`cleanmail:acct:${account.id}:password`,
			legacyPassword,
		);

		await writeAccounts([account]);

		// Clean up legacy keytar entries
		await keytar.deletePassword(LEGACY_KEYTAR_SERVICE, LEGACY_KEYTAR_CONFIG);
		await keytar.deletePassword(LEGACY_KEYTAR_SERVICE, LEGACY_KEYTAR_PASSWORD);

		return [account];
	} catch {
		return [];
	}
}

export async function writeAccounts(accounts: Account[]): Promise<void> {
	await mkdir(APP_DATA_DIR, { recursive: true });
	await Bun.write(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

export async function getAccountById(id: string): Promise<Account | null> {
	const accounts = await readAccounts();
	return accounts.find((a) => a.id === id) ?? null;
}
