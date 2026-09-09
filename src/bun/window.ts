import type { BrowserWindow } from "electrobun/bun";

let mainWindow: BrowserWindow | null = null;

export function setMainWindow(win: BrowserWindow): void {
	mainWindow = win;
}

export function getMainWindow(): BrowserWindow {
	if (!mainWindow) throw new Error("Main window not initialized");
	return mainWindow;
}
