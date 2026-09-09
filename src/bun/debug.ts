import { appendFileSync } from "node:fs";
import { join } from "node:path";

function resolveLogPath(): string {
	// Prefer the project root (cwd) so it's easy to find; fall back near source.
	const candidates = [
		join(process.cwd(), "oauth-debug.log"),
		join(import.meta.dir, "..", "..", "oauth-debug.log"),
		join(import.meta.dir, "oauth-debug.log"),
	];
	return candidates[0] ?? "oauth-debug.log";
}

const LOG_PATH = resolveLogPath();

export function debugLog(msg: string): void {
	const entry = `[${new Date().toISOString()}] ${msg}\n`;
	// Always surface in the bun terminal...
	console.error("[oauth-debug]", msg);
	// ...and persist to a file the user can open and paste back.
	try {
		appendFileSync(LOG_PATH, entry);
	} catch {
		// best-effort: logging must never break the flow
	}
}
