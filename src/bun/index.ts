import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { BrowserView, BrowserWindow, Updater } from "electrobun/bun";
import { ImapFlow } from "imapflow";
import keytar from "keytar";
import type {
	ActionStatusUpdate,
	CleanMailRPC,
	Email,
	EmailDetail,
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

// ---------------------------------------------------------------------------
// Background job queue
// ---------------------------------------------------------------------------

type ApplyMoveJob = {
	type: "move";
	jobId: string;
	authorEmail: string;
	fromMailboxPath: string;
	toMailboxPath: string;
};

type ApplyDeleteJob = {
	type: "delete";
	jobId: string;
	authorEmail: string;
	mailboxPath: string;
};

type ApplyJob = ApplyMoveJob | ApplyDeleteJob;

const jobQueue: ApplyJob[] = [];

/**
 * Sends an `actionStatusUpdate` message to the webview.
 * Must be called after `rpc` is fully initialised (see bottom of file).
 */
function notifyWebview(update: ActionStatusUpdate) {
	try {
		rpc.send.actionStatusUpdate(update);
	} catch {
		// webview may not be ready yet — ignore
	}
}

async function createImapClient() {
	const configJson = await keytar.getPassword(
		KEYTAR_SERVICE,
		KEYTAR_ACCOUNT_CONFIG,
	);
	const password = await keytar.getPassword(
		KEYTAR_SERVICE,
		KEYTAR_ACCOUNT_PASSWORD,
	);

	if (!configJson || !password) {
		throw new Error("IMAP not configured");
	}

	let config: { host: string; port: number; username: string };
	try {
		config = JSON.parse(configJson);
	} catch {
		throw new Error("Invalid IMAP config");
	}

	return new ImapFlow({
		host: config.host,
		port: config.port,
		secure: config.port === 993,
		auth: {
			user: config.username,
			pass: password,
		},
		logger: false,
	});
}

async function processJob(job: ApplyJob) {
	notifyWebview({ jobId: job.jobId, status: "running" });

	let client: ImapFlow | undefined;
	try {
		client = await createImapClient();
		await client.connect();

		if (job.type === "move") {
			// Find all UIDs from this sender in the source mailbox
			const lock = await client.getMailboxLock(job.fromMailboxPath);
			try {
				const uids = (await client.search(
					{ from: job.authorEmail },
					{ uid: true },
				)) as number[];

				if (uids.length > 0) {
					await client.messageMove({ uid: uids.join(",") }, job.toMailboxPath, {
						uid: true,
					});
				}
			} finally {
				lock.release();
			}
		} else {
			// delete job
			// Determine trash mailbox (if any) so we respect the trash rule
			const mailboxList = await client.list();
			const trashMailbox = mailboxList.find(
				(m) =>
					m.specialUse === "\\Trash" ||
					m.name.toLowerCase() === "trash" ||
					m.path.toLowerCase() === "trash",
			);
			const trashMailboxPath = trashMailbox?.path;

			const alreadyInTrash =
				trashMailboxPath &&
				job.mailboxPath.toLowerCase() === trashMailboxPath.toLowerCase();

			const lock = await client.getMailboxLock(job.mailboxPath);
			try {
				const uids = (await client.search(
					{ from: job.authorEmail },
					{ uid: true },
				)) as number[];

				if (uids.length > 0) {
					if (trashMailboxPath && !alreadyInTrash) {
						await client.messageMove(
							{ uid: uids.join(",") },
							trashMailboxPath,
							{ uid: true },
						);
					} else {
						await client.messageDelete({ uid: uids.join(",") }, { uid: true });
					}
				}
			} finally {
				lock.release();
			}
		}

		await client.logout();
		notifyWebview({ jobId: job.jobId, status: "success" });
	} catch (err) {
		try {
			await client?.logout();
		} catch {
			// ignore
		}
		notifyWebview({
			jobId: job.jobId,
			status: "error",
			error: err instanceof Error ? err.message : String(err),
		});
	}
}

// Process one job per second
setInterval(async () => {
	if (jobQueue.length > 0) {
		const job = jobQueue.shift()!;
		await processJob(job);
	}
}, 1000);

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
	maxRequestTime: 30 * 1000,
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

			fetchEmails: async ({
				mailboxPath,
				page = 1,
				itemsPerPage = 20,
				from,
			}) => {
				const configJson = await keytar.getPassword(
					KEYTAR_SERVICE,
					KEYTAR_ACCOUNT_CONFIG,
				);
				const password = await keytar.getPassword(
					KEYTAR_SERVICE,
					KEYTAR_ACCOUNT_PASSWORD,
				);

				if (!configJson || !password) {
					return { emails: [], total: 0, error: "IMAP not configured" };
				}

				let config: { host: string; port: number; username: string };
				try {
					config = JSON.parse(configJson);
				} catch {
					return { emails: [], total: 0, error: "Invalid IMAP config" };
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
					let matchedTotal = 0;

					try {
						const mailbox = client.mailbox;
						const total = mailbox ? (mailbox.exists ?? 0) : 0;

						if (total > 0) {
							const offset = (page - 1) * itemsPerPage;

							let fetchRange: { uid: string } | { seq: string } | undefined;

							if (from) {
								// Use UID SEARCH so the server filters by the From header.
								// UIDs are returned ascending; reversing gives newest-first order,
								// then we page-slice before fetching — avoiding building a full
								// sequence array in memory.
								const allUids = (await client.search(
									{ from },
									{ uid: true },
								)) as number[];
								matchedTotal = allUids.length;

								const pageUids = allUids
									.slice()
									.reverse()
									.slice(offset, offset + itemsPerPage);

								if (pageUids.length > 0) {
									fetchRange = { uid: pageUids.join(",") };
								}
							} else {
								// No filter — compute the seq range arithmetically (no SEARCH needed).
								// Sequences are 1-based; the newest message has seq = total.
								matchedTotal = total;
								const seqEnd = Math.max(1, total - offset);
								const seqStart = Math.max(1, seqEnd - itemsPerPage + 1);
								fetchRange = { seq: `${seqStart}:${seqEnd}` };
							}

							if (fetchRange !== undefined) {
								const messages = [];
								for await (const message of client.fetch(
									fetchRange,
									{ uid: true, envelope: true, flags: true },
									{ uid: "uid" in fetchRange },
								)) {
									messages.push(message);
								}

								for (const msg of messages) {
									const envelope = msg.envelope;
									if (!envelope) continue;

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
										date: envelope.date
											? envelope.date.toISOString()
											: "Unknown",
										seen: msg.flags?.has("\\Seen") ?? false,
									});
								}

								// Sort newest first (fetch order is not guaranteed)
								emails.sort(
									(a, b) =>
										new Date(b.date).getTime() - new Date(a.date).getTime(),
								);
							}
						}
					} finally {
						lock.release();
					}

					await client.logout();
					return { emails, total: matchedTotal };
				} catch (err) {
					try {
						await client.logout();
					} catch {
						// ignore logout errors
					}
					return {
						emails: [],
						total: 0,
						error: err instanceof Error ? err.message : String(err),
					};
				}
			},

			fetchEmailDetail: async ({ mailboxPath, uid }) => {
				let client: ImapFlow | undefined;
				try {
					client = await createImapClient();
					await client.connect();

					const lock = await client.getMailboxLock(mailboxPath);
					let email: EmailDetail | null = null;

					try {
						const msg = await client.fetchOne(
							String(uid),
							{ uid: true, envelope: true, flags: true, bodyStructure: true },
							{ uid: true },
						);

						if (msg) {
							const envelope = msg.envelope;
							if (envelope) {
								const fromAddress = envelope.from?.[0];
								const fromStr = fromAddress
									? fromAddress.name
										? `${fromAddress.name} <${fromAddress.address}>`
										: (fromAddress.address ?? "")
									: "Unknown";

								let htmlBody: string | null = null;
								let textBody: string | null = null;

								// Find a part by MIME type, recursing into multipart nodes
								const findPart = (
									part: NonNullable<typeof msg.bodyStructure>,
									targetType: string,
								): NonNullable<typeof msg.bodyStructure> | null => {
									if (part.type === targetType) return part;
									if (part.childNodes) {
										for (const child of part.childNodes) {
											const found = findPart(child, targetType);
											if (found) return found;
										}
									}
									return null;
								};

								// Helper to read a Readable stream into a Buffer
								const readStream = async (
									readable: NodeJS.ReadableStream,
								): Promise<Buffer> => {
									const chunks: Buffer[] = [];
									for await (const chunk of readable) {
										chunks.push(
											Buffer.isBuffer(chunk)
												? chunk
												: Buffer.from(chunk as string),
										);
									}
									return Buffer.concat(chunks);
								};

								const structure = msg.bodyStructure;
								const htmlPart = structure
									? findPart(structure, "text/html")
									: null;
								const textPart = structure
									? findPart(structure, "text/plain")
									: null;

								if (htmlPart?.part) {
									try {
										const dl = await client.download(
											String(uid),
											htmlPart.part,
											{ uid: true },
										);
										const buf = await readStream(dl.content);
										const enc = (htmlPart.parameters?.charset ??
											dl.meta.charset ??
											"utf-8") as BufferEncoding;
										htmlBody = buf.toString(enc);
									} catch {
										// fallback: will try text part below
									}
								}

								if (textPart?.part) {
									try {
										const dl = await client.download(
											String(uid),
											textPart.part,
											{ uid: true },
										);
										const buf = await readStream(dl.content);
										const enc = (textPart.parameters?.charset ??
											dl.meta.charset ??
											"utf-8") as BufferEncoding;
										textBody = buf.toString(enc);
									} catch {
										// fallback below
									}
								}

								// Final fallback: download full message source
								if (htmlBody === null && textBody === null) {
									try {
										const dl = await client.download(String(uid), undefined, {
											uid: true,
										});
										const buf = await readStream(dl.content);
										textBody = buf.toString("utf-8");
									} catch {
										textBody = null;
									}
								}

								email = {
									uid: msg.uid,
									subject: envelope.subject ?? "(no subject)",
									from: fromStr,
									date: envelope.date ? envelope.date.toISOString() : "Unknown",
									seen: msg.flags?.has("\\Seen") ?? false,
									htmlBody,
									textBody,
								};
							}
						}
					} finally {
						lock.release();
					}

					await client.logout();
					return { email };
				} catch (err) {
					try {
						await client?.logout();
					} catch {
						// ignore logout errors
					}
					return {
						email: null,
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

			applyMoveAction: async ({
				jobId,
				authorEmail,
				fromMailboxPath,
				toMailboxPath,
			}) => {
				// Check that a job with this id is not already queued/running
				const alreadyQueued = jobQueue.some((j) => j.jobId === jobId);
				if (alreadyQueued) {
					return { queued: false, error: "Job already queued" };
				}
				jobQueue.push({
					type: "move",
					jobId,
					authorEmail,
					fromMailboxPath,
					toMailboxPath,
				});
				return { queued: true };
			},

			applyDeleteAction: async ({ jobId, authorEmail, mailboxPath }) => {
				const alreadyQueued = jobQueue.some((j) => j.jobId === jobId);
				if (alreadyQueued) {
					return { queued: false, error: "Job already queued" };
				}
				jobQueue.push({
					type: "delete",
					jobId,
					authorEmail,
					mailboxPath,
				});
				return { queued: true };
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
