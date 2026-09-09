import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import keytar from "keytar";
import type { Account, PersistedAction } from "../shared/rpc-types";

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
