import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { PersistedAction } from "../shared/rpc-types";

const APP_NAME = "cleanmail";

/**
 * Returns the OS-appropriate application data directory, mirroring Tauri's
 * path resolution:
 *   - Linux:   $XDG_DATA_HOME/cleanmail  (fallback: ~/.local/share/cleanmail)
 *   - macOS:   ~/Library/Application Support/cleanmail
 *   - Windows: %APPDATA%\cleanmail
 */
export function getAppDataDir(): string {
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
	// Windows
	const appData = process.env.APPDATA ?? join(home, "AppData", "Roaming");
	return join(appData, APP_NAME);
}

const APP_DATA_DIR = getAppDataDir();
const ACTIONS_FILE = join(APP_DATA_DIR, "actions.json");

export async function readActions(): Promise<PersistedAction[]> {
	try {
		const file = Bun.file(ACTIONS_FILE);
		const exists = await file.exists();
		if (!exists) return [];
		const text = await file.text();
		return JSON.parse(text) as PersistedAction[];
	} catch {
		return [];
	}
}

export async function writeActions(actions: PersistedAction[]): Promise<void> {
	await mkdir(APP_DATA_DIR, { recursive: true });
	await Bun.write(ACTIONS_FILE, JSON.stringify(actions, null, 2));
}
