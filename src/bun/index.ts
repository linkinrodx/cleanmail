import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { BrowserWindow, Updater } from "electrobun/bun";
import { debugLog } from "./debug";
import { rpc } from "./rpc";
import { setMainWindow } from "./window";

// Electrobun's bun runtime does not auto-load .env, so we load it explicitly
// before any code reads Bun.env (OAuth client IDs, callback port, etc.).
await loadDotenv();

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch (e) {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
			throw e;
		}
	}
	return "views://mainview/index.html";
}

const url = await getMainViewUrl();

const win = new BrowserWindow({
	title: "CleanMail",
	url,
	titleBarStyle: "hiddenInset",
	frame: { width: 1200, height: 800 },
	rpc,
});

setMainWindow(win);

win.on("resize", () => {
	rpc.send.windowStateChanged({
		isMaximized: win.isMaximized(),
		isMinimized: win.isMinimized(),
		isFullScreen: win.isFullScreen(),
	});
});

console.log("Cleanmail started!");

/**
 * Load environment variables from `.env`. Electrobun's bun runtime may not
 * auto-load dotenv and can run the bundle from an unpredictable cwd, so we
 * resolve `.env` by walking upward from this source file and from the cwd.
 */
async function loadDotenv() {
	const bunWithLoadEnv = Bun as unknown as { loadEnv?: () => void };
	bunWithLoadEnv.loadEnv?.();

	// Already loaded (e.g. via OS env or Bun's auto-load): nothing to do.
	if (Bun.env.MS_CLIENT_ID || Bun.env.GOOGLE_CLIENT_ID) {
		debugLog(
			`[env] already loaded MS=${!!Bun.env.MS_CLIENT_ID} GOOGLE=${!!Bun.env.GOOGLE_CLIENT_ID}`,
		);
		return;
	}

	// Walk upward from this source file and from cwd to locate .env robustly.
	const searchRoots = [import.meta.dir, process.cwd()];
	let envPath: string | null = null;
	for (const root of searchRoots) {
		let dir = root;
		while (true) {
			const candidate = join(dir, ".env");
			if (existsSync(candidate)) {
				envPath = candidate;
				break;
			}
			const parent = dirname(dir);
			if (parent === dir) break;
			dir = parent;
		}
		if (envPath) break;
	}

	if (envPath) {
		try {
			const content = await Bun.file(envPath).text();
			for (const rawLine of content.split("\n")) {
				const line = rawLine.trim();
				if (!line || line.startsWith("#")) continue;
				const eq = line.indexOf("=");
				if (eq === -1) continue;
				const key = line.slice(0, eq).trim();
				let value = line.slice(eq + 1).trim();
				if (
					(value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))
				) {
					value = value.slice(1, -1);
				}
				if (Bun.env[key] === undefined) {
					Bun.env[key] = value;
				}
			}
			debugLog(`[env] loaded .env from ${envPath}`);
		} catch (err) {
			debugLog(`[env] failed to read ${envPath}: ${String(err)}`);
		}
	} else {
		debugLog("[env] no .env found via upward walk from source/cwd");
	}

	debugLog(
		`[env] after loadDotenv -> MS=${!!Bun.env.MS_CLIENT_ID} GOOGLE=${!!Bun.env.GOOGLE_CLIENT_ID}`,
	);
}
