import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { BrowserView, BrowserWindow, Updater } from "electrobun/bun";
import { ImapFlow } from "imapflow";
import keytar from "keytar";
import type {
	CleanMailRPC,
	Email,
	Mailbox,
	PersistedAction,
} from "../shared/rpc-types";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

const KEYTAR_SERVICE = "cleanmail";
const KEYTAR_ACCOUNT_CONFIG = "imap-config";
const KEYTAR_ACCOUNT_PASSWORD = "imap-password";

const APP_NAME = "cleanmail";

/**
 * Returns the OS-appropriate application data directory, mirroring Tauri's
 * path resolution:
 *   - Linux:   $XDG_DATA_HOME/cleanmail  (fallback: ~/.local/share/cleanmail)
 *   - macOS:   ~/Library/Application Support/cleanmail
 *   - Windows: %APPDATA%\cleanmail
 */
function getAppDataDir(): string {
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

async function readActions(): Promise<PersistedAction[]> {
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

async function writeActions(actions: PersistedAction[]): Promise<void> {
	await mkdir(APP_DATA_DIR, { recursive: true });
	await Bun.write(ACTIONS_FILE, JSON.stringify(actions, null, 2));
}

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

const rpc = BrowserView.defineRPC<CleanMailRPC>({
	handlers: {
		requests: {
			getImapConfig: async () => {
				const configJson = await keytar.getPassword(
					KEYTAR_SERVICE,
					KEYTAR_ACCOUNT_CONFIG,
				);
				if (!configJson) return null;
				try {
					return JSON.parse(configJson) as {
						host: string;
						port: number;
						username: string;
					};
				} catch {
					return null;
				}
			},

			saveImapConfig: async ({ host, port, username, password }) => {
				try {
					await keytar.setPassword(
						KEYTAR_SERVICE,
						KEYTAR_ACCOUNT_CONFIG,
						JSON.stringify({ host, port, username }),
					);
					await keytar.setPassword(
						KEYTAR_SERVICE,
						KEYTAR_ACCOUNT_PASSWORD,
						password,
					);
					return { success: true };
				} catch (err) {
					return {
						success: false,
						error: err instanceof Error ? err.message : String(err),
					};
				}
			},

			fetchEmails: async ({ mailboxPath }) => {
				const configJson = await keytar.getPassword(
					KEYTAR_SERVICE,
					KEYTAR_ACCOUNT_CONFIG,
				);
				const password = await keytar.getPassword(
					KEYTAR_SERVICE,
					KEYTAR_ACCOUNT_PASSWORD,
				);

				if (!configJson || !password) {
					return { emails: [], error: "IMAP not configured" };
				}

				let config: { host: string; port: number; username: string };
				try {
					config = JSON.parse(configJson);
				} catch {
					return { emails: [], error: "Invalid IMAP config" };
				}

				const client = new ImapFlow({
					host: config.host,
					port: config.port,
					secure: config.port === 993,
					auth: {
						user: config.username,
						pass: password,
					},
					logger: false,
				});

				try {
					await client.connect();

					const lock = await client.getMailboxLock(mailboxPath);
					const emails: Email[] = [];

					try {
						const messages = [];
						const mailbox = client.mailbox;
						const total = mailbox ? (mailbox.exists ?? 0) : 0;
						if (total > 0) {
							const start = Math.max(1, total - 19);
							for await (const message of client.fetch(
								{ seq: `${start}:*` }, // Take last 20
								{
									uid: true,
									envelope: true,
									flags: true,
								},
								{ uid: false },
							)) {
								messages.push(message);
							}
						}

						for (const msg of messages) {
							const envelope = msg.envelope;
							if (!envelope) {
								continue;
							}

							const fromAddress = envelope.from?.[0];
							const fromStr = fromAddress
								? fromAddress.name
									? `${fromAddress.name} <${fromAddress.address}>`
									: (fromAddress.address ?? "")
								: "Unknown";

							emails.push({
								uid: msg.uid,
								subject: envelope.subject ?? "(no subject)",
								from: fromStr,
								date: envelope.date ? envelope.date.toISOString() : "Unknown",
								seen: msg.flags?.has("\\Seen") ?? false,
							});
						}
					} finally {
						lock.release();
					}

					await client.logout();
					return { emails };
				} catch (err) {
					try {
						await client.logout();
					} catch {
						// ignore logout errors
					}
					return {
						emails: [],
						error: err instanceof Error ? err.message : String(err),
					};
				}
			},

			fetchMailboxes: async () => {
				const configJson = await keytar.getPassword(
					KEYTAR_SERVICE,
					KEYTAR_ACCOUNT_CONFIG,
				);
				const password = await keytar.getPassword(
					KEYTAR_SERVICE,
					KEYTAR_ACCOUNT_PASSWORD,
				);

				if (!configJson || !password) {
					return { mailboxes: [], error: "IMAP not configured" };
				}

				let config: { host: string; port: number; username: string };
				try {
					config = JSON.parse(configJson);
				} catch {
					return { mailboxes: [], error: "Invalid IMAP config" };
				}

				const client = new ImapFlow({
					host: config.host,
					port: config.port,
					secure: config.port === 993,
					auth: {
						user: config.username,
						pass: password,
					},
					logger: false,
				});

				try {
					await client.connect();

					const mailboxes: Mailbox[] = [];

					// List all mailboxes recursively
					const tree = await client.listTree();

					// Flatten the tree into a list of mailboxes
					const flattenTree = (
						folders: typeof tree.folders | undefined,
						delimiter: string,
					) => {
						if (!folders) return;
						for (const folder of folders) {
							if (!folder.listed) continue;
							if (!folder.path || !folder.name) continue;

							mailboxes.push({
								path: folder.path,
								name: folder.name,
								delimiter,
								flags: [...(folder.flags ?? [])],
								specialUse: folder.specialUse ?? undefined,
								unreadCount: 0, // Will be populated below
							});

							if (folder.folders?.length) {
								flattenTree(folder.folders, delimiter);
							}
						}
					};

					flattenTree(tree.folders, tree.delimiter ?? "/");

					// Fetch unread counts for each mailbox
					await Promise.all(
						mailboxes.map(async (mailbox) => {
							try {
								const status = await client.status(mailbox.path, {
									unseen: true,
								});
								mailbox.unreadCount = status.unseen ?? 0;
							} catch {
								// Skip mailboxes that can't be queried
							}
						}),
					);

					await client.logout();
					return { mailboxes };
				} catch (err) {
					try {
						await client.logout();
					} catch {
						// ignore logout errors
					}
					return {
						mailboxes: [],
						error: err instanceof Error ? err.message : String(err),
					};
				}
			},

			createMailbox: async ({ name }) => {
				const configJson = await keytar.getPassword(
					KEYTAR_SERVICE,
					KEYTAR_ACCOUNT_CONFIG,
				);
				const password = await keytar.getPassword(
					KEYTAR_SERVICE,
					KEYTAR_ACCOUNT_PASSWORD,
				);

				if (!configJson || !password) {
					return { success: false, error: "IMAP not configured" };
				}

				let config: { host: string; port: number; username: string };
				try {
					config = JSON.parse(configJson);
				} catch {
					return { success: false, error: "Invalid IMAP config" };
				}

				const client = new ImapFlow({
					host: config.host,
					port: config.port,
					secure: config.port === 993,
					auth: {
						user: config.username,
						pass: password,
					},
					logger: false,
				});

				try {
					await client.connect();
					await client.mailboxCreate(name);
					await client.logout();
					return { success: true };
				} catch (err) {
					try {
						await client.logout();
					} catch {
						// ignore logout errors
					}
					return {
						success: false,
						error: err instanceof Error ? err.message : String(err),
					};
				}
			},

			moveEmail: async ({ fromMailboxPath, toMailboxPath, uid }) => {
				const configJson = await keytar.getPassword(
					KEYTAR_SERVICE,
					KEYTAR_ACCOUNT_CONFIG,
				);
				const password = await keytar.getPassword(
					KEYTAR_SERVICE,
					KEYTAR_ACCOUNT_PASSWORD,
				);

				if (!configJson || !password) {
					return { success: false, error: "IMAP not configured" };
				}

				let config: { host: string; port: number; username: string };
				try {
					config = JSON.parse(configJson);
				} catch {
					return { success: false, error: "Invalid IMAP config" };
				}

				const client = new ImapFlow({
					host: config.host,
					port: config.port,
					secure: config.port === 993,
					auth: {
						user: config.username,
						pass: password,
					},
					logger: false,
				});

				try {
					await client.connect();

					const lock = await client.getMailboxLock(fromMailboxPath);
					try {
						await client.messageMove({ uid }, toMailboxPath, { uid: true });
					} finally {
						lock.release();
					}

					await client.logout();
					return { success: true };
				} catch (err) {
					try {
						await client.logout();
					} catch {
						// ignore logout errors
					}
					return {
						success: false,
						error: err instanceof Error ? err.message : String(err),
					};
				}
			},

			deleteEmail: async ({ mailboxPath, uid, trashMailboxPath }) => {
				const configJson = await keytar.getPassword(
					KEYTAR_SERVICE,
					KEYTAR_ACCOUNT_CONFIG,
				);
				const password = await keytar.getPassword(
					KEYTAR_SERVICE,
					KEYTAR_ACCOUNT_PASSWORD,
				);

				if (!configJson || !password) {
					return { success: false, error: "IMAP not configured" };
				}

				let config: { host: string; port: number; username: string };
				try {
					config = JSON.parse(configJson);
				} catch {
					return { success: false, error: "Invalid IMAP config" };
				}

				const client = new ImapFlow({
					host: config.host,
					port: config.port,
					secure: config.port === 993,
					auth: {
						user: config.username,
						pass: password,
					},
					logger: false,
				});

				try {
					await client.connect();

					// If a trash mailbox exists and the email is not already in it,
					// move to trash instead of permanently deleting.
					const alreadyInTrash =
						trashMailboxPath &&
						mailboxPath.toLowerCase() === trashMailboxPath.toLowerCase();

					if (trashMailboxPath && !alreadyInTrash) {
						const lock = await client.getMailboxLock(mailboxPath);
						try {
							await client.messageMove({ uid }, trashMailboxPath, {
								uid: true,
							});
						} finally {
							lock.release();
						}
					} else {
						const lock = await client.getMailboxLock(mailboxPath);
						try {
							await client.messageDelete({ uid }, { uid: true });
						} finally {
							lock.release();
						}
					}

					await client.logout();
					return { success: true };
				} catch (err) {
					try {
						await client.logout();
					} catch {
						// ignore logout errors
					}
					return {
						success: false,
						error: err instanceof Error ? err.message : String(err),
					};
				}
			},

			getActions: async () => {
				try {
					const actions = await readActions();
					return { actions };
				} catch (err) {
					return {
						actions: [],
						error: err instanceof Error ? err.message : String(err),
					};
				}
			},

			addAction: async (newAction) => {
				try {
					const actions = await readActions();
					// Deduplicate by comparing action type + key fields
					const isDuplicate = actions.some((a) => {
						if (a.action !== newAction.action) return false;
						if (a.action === "MOVE" && newAction.action === "MOVE") {
							return (
								a.data.uid === newAction.data.uid &&
								a.data.fromMailboxPath === newAction.data.fromMailboxPath &&
								a.data.toMailboxPath === newAction.data.toMailboxPath
							);
						}
						if (a.action === "DELETE" && newAction.action === "DELETE") {
							return (
								a.data.uid === newAction.data.uid &&
								a.data.mailboxPath === newAction.data.mailboxPath
							);
						}
						return false;
					});
					if (!isDuplicate) {
						actions.push(newAction);
						await writeActions(actions);
					}
					return { success: true };
				} catch (err) {
					return {
						success: false,
						error: err instanceof Error ? err.message : String(err),
					};
				}
			},

			removeAction: async ({ createdAt }) => {
				try {
					const actions = await readActions();
					const filtered = actions.filter((a) => a.createdAt !== createdAt);
					await writeActions(filtered);
					return { success: true };
				} catch (err) {
					return {
						success: false,
						error: err instanceof Error ? err.message : String(err),
					};
				}
			},
		},
	},
});

const url = await getMainViewUrl();

new BrowserWindow({
	title: "CleanMail",
	url,
	titleBarStyle: "hidden",
	rpc,
});

console.log("Cleanmail started!");
