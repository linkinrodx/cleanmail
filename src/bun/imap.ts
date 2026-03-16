import { ImapFlow } from "imapflow";
import keytar from "keytar";
import type {
	DeleteEmailData,
	Email,
	EmailDetail,
	FetchEmailDetail,
	FetchEmailsData,
	ImapConfig,
	Mailbox,
	MoveEmailData,
	SaveImapConfigData,
} from "../shared/rpc-types";

const KEYTAR_SERVICE = "cleanmail";
const KEYTAR_ACCOUNT_CONFIG = "imap-config";
const KEYTAR_ACCOUNT_PASSWORD = "imap-password";

const getImapConfig = async (): Promise<ImapConfig> => {
	const configJson = await keytar.getPassword(
		KEYTAR_SERVICE,
		KEYTAR_ACCOUNT_CONFIG,
	);
	if (!configJson) {
		throw new Error("IMAP not configured");
	}

	try {
		const config = JSON.parse(configJson);
		return config;
	} catch {
		throw new Error("Invalid IMAP config");
	}
};

const getImapPassword = async (): Promise<string> => {
	const password = await keytar.getPassword(
		KEYTAR_SERVICE,
		KEYTAR_ACCOUNT_PASSWORD,
	);
	if (!password) {
		throw new Error("IMAP not configured");
	}

	return password;
};

export const createImapClient = async (): Promise<ImapFlow> => {
	const config = await getImapConfig();
	const password = await getImapPassword();

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
};

/**
 * Count how many emails in `mailboxPath` were sent from `authorEmail`.
 * Returns 0 on any error (treat as "no matches").
 */
export const countEmailsFrom = async ({
	mailboxPath,
	authorEmail,
}: {
	mailboxPath: string;
	authorEmail: string;
}): Promise<number> => {
	let client: ImapFlow | undefined;
	try {
		client = await createImapClient();
		await client.connect();

		const lock = await client.getMailboxLock(mailboxPath);
		let count = 0;
		try {
			const uids = (await client.search(
				{ from: authorEmail },
				{ uid: true },
			)) as number[];
			count = uids.length;
		} finally {
			lock.release();
		}

		await client.logout();
		return count;
	} catch {
		try {
			await client?.logout();
		} catch {
			// ignore logout errors
		}
		return 0;
	}
};

export async function rpcGetImapConfig() {
	try {
		return await getImapConfig();
	} catch {
		return null;
	}
}

export async function rpcSaveImapConfig({
	host,
	port,
	username,
	password,
}: SaveImapConfigData) {
	try {
		await keytar.setPassword(
			KEYTAR_SERVICE,
			KEYTAR_ACCOUNT_CONFIG,
			JSON.stringify({ host, port, username }),
		);
		await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_PASSWORD, password);

		return { success: true };
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

export async function rpcFetchEmails({
	mailboxPath,
	page = 1,
	itemsPerPage = 20,
	from,
}: FetchEmailsData) {
	let client: ImapFlow | undefined;

	try {
		client = await createImapClient();
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

					// Sort newest first (fetch order is not guaranteed)
					emails.sort(
						(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
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
			await client?.logout();
		} catch {
			// ignore logout errors
		}
		return {
			emails: [],
			total: 0,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

export async function rpcFetchEmailDetail({
	mailboxPath,
	uid,
}: FetchEmailDetail) {
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
						if (part.type === targetType) {
							return part;
						}
						if (part.childNodes) {
							for (const child of part.childNodes) {
								const found = findPart(child, targetType);
								if (found) {
									return found;
								}
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
								Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string),
							);
						}
						return Buffer.concat(chunks);
					};

					const structure = msg.bodyStructure;
					const htmlPart = structure ? findPart(structure, "text/html") : null;
					const textPart = structure ? findPart(structure, "text/plain") : null;

					if (htmlPart?.part) {
						try {
							const dl = await client.download(String(uid), htmlPart.part, {
								uid: true,
							});
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
							const dl = await client.download(String(uid), textPart.part, {
								uid: true,
							});
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
						} catch {}
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
}

export async function rpcFetchMailboxes() {
	let client: ImapFlow | undefined;

	try {
		client = await createImapClient();
		await client.connect();

		const mailboxes: Mailbox[] = [];

		// List all mailboxes recursively
		const tree = await client.listTree();

		// Flatten the tree into a list of mailboxes
		const flattenTree = (
			folders: typeof tree.folders | undefined,
			delimiter: string,
		) => {
			if (!folders) {
				return;
			}

			for (const folder of folders) {
				if (!folder.listed) {
					continue;
				}
				if (!folder.path || !folder.name) {
					continue;
				}

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
					// biome-ignore lint/style/noNonNullAssertion: client not null
					const status = await client!.status(mailbox.path, { unseen: true });
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
			await client?.logout();
		} catch {
			// ignore logout errors
		}
		return {
			mailboxes: [],
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

export async function rpcCreateMailbox({ name }: { name: string }) {
	let client: ImapFlow | undefined;

	try {
		client = await createImapClient();
		await client.connect();
		await client.mailboxCreate(name);
		await client.logout();

		return { success: true };
	} catch (err) {
		try {
			await client?.logout();
		} catch {
			// ignore logout errors
		}
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

export async function rpcMoveEmail({
	fromMailboxPath,
	toMailboxPath,
	uid,
}: MoveEmailData) {
	let client: ImapFlow | undefined;

	try {
		client = await createImapClient();
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
			await client?.logout();
		} catch {
			// ignore logout errors
		}
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

export async function rpcDeleteEmail({
	mailboxPath,
	uid,
	trashMailboxPath,
}: DeleteEmailData) {
	let client: ImapFlow | undefined;
	try {
		client = await createImapClient();
		await client.connect();

		// If a trash mailbox exists and the email is not already in it,
		// move to trash instead of permanently deleting.
		const alreadyInTrash =
			trashMailboxPath &&
			mailboxPath.toLowerCase() === trashMailboxPath.toLowerCase();

		const lock = await client.getMailboxLock(mailboxPath);

		try {
			if (trashMailboxPath && !alreadyInTrash) {
				await client.messageMove({ uid }, trashMailboxPath, { uid: true });
			} else {
				await client.messageDelete({ uid }, { uid: true });
			}
		} finally {
			lock.release();
		}

		await client.logout();
		return { success: true };
	} catch (err) {
		try {
			await client?.logout();
		} catch {
			// ignore logout errors
		}
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}
