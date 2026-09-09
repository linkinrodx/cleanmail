import { ImapFlow } from "imapflow";
import keytar from "keytar";
import type {
	DeleteEmailData,
	Email,
	EmailDetail,
	FetchEmailDetail,
	FetchEmailsData,
	Mailbox,
	MoveEmailData,
} from "../shared/rpc-types";
import type { Account } from "../shared/rpc-types";
import { getAccountById } from "./storage";
import { getValidAccessToken } from "./oauth";

const KEYTAR_SERVICE = "cleanmail";
const KEYTAR_ACCOUNT_PASSWORD = (accountId: string) =>
	`cleanmail:acct:${accountId}:password`;

export async function getAccountCredentials(account: Account): Promise<{
	user: string;
	accessToken?: string;
	pass?: string;
}> {
	if (account.authMethod === "password") {
		const password = await keytar.getPassword(
			KEYTAR_SERVICE,
			KEYTAR_ACCOUNT_PASSWORD(account.id),
		);
		if (!password) {
			throw new Error("Password not found for account");
		}
		return { user: account.email, pass: password };
	}

	const accessToken = await getValidAccessToken(account.id);
	return { user: account.email, accessToken };
}

export async function createImapClient(account: Account): Promise<ImapFlow> {
	const credentials = await getAccountCredentials(account);

	const authConfig: { user: string; pass?: string; accessToken?: string } = {
		user: credentials.user,
	};

	if (account.authMethod === "password") {
		authConfig.pass = credentials.pass;
	} else {
		authConfig.accessToken = credentials.accessToken;
	}

	return new ImapFlow({
		host: account.host,
		port: account.port,
		secure: account.port === 993,
		auth: authConfig,
		logger: false,
	});
}

export async function countEmailsFrom({
	accountId,
	mailboxPath,
	authorEmail,
}: {
	accountId: string;
	mailboxPath: string;
	authorEmail: string;
}): Promise<number> {
	const account = await getAccountById(accountId);
	if (!account) {
		return 0;
	}

	let client: ImapFlow | undefined;
	try {
		client = await createImapClient(account);
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
}

export async function rpcFetchEmails({
	accountId,
	mailboxPath,
	page = 1,
	itemsPerPage = 20,
	from,
}: FetchEmailsData) {
	const account = await getAccountById(accountId);
	if (!account) {
		return { emails: [], total: 0, error: "Account not found" };
	}

	let client: ImapFlow | undefined;

	try {
		client = await createImapClient(account);
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
	accountId,
	mailboxPath,
	uid,
}: FetchEmailDetail) {
	const account = await getAccountById(accountId);
	if (!account) {
		return { email: null, error: "Account not found" };
	}

	let client: ImapFlow | undefined;

	try {
		client = await createImapClient(account);
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

export async function rpcFetchMailboxes({ accountId }: { accountId: string }) {
	const account = await getAccountById(accountId);
	if (!account) {
		return { mailboxes: [], error: "Account not found" };
	}

	let client: ImapFlow | undefined;

	try {
		client = await createImapClient(account);
		await client.connect();

		const mailboxes: Mailbox[] = [];

		const tree = await client.listTree();

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
					unreadCount: 0,
				});

				if (folder.folders?.length) {
					flattenTree(folder.folders, delimiter);
				}
			}
		};

		flattenTree(tree.folders, tree.delimiter ?? "/");

		await Promise.all(
			mailboxes.map(async (mailbox) => {
				try {
					const status = await client?.status(mailbox.path, { unseen: true });
					mailbox.unreadCount = status?.unseen ?? 0;
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

export async function rpcCreateMailbox({
	accountId,
	name,
}: {
	accountId: string;
	name: string;
}) {
	const account = await getAccountById(accountId);
	if (!account) {
		return { success: false, error: "Account not found" };
	}

	let client: ImapFlow | undefined;

	try {
		client = await createImapClient(account);
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
	accountId,
	fromMailboxPath,
	toMailboxPath,
	uid,
}: MoveEmailData) {
	const account = await getAccountById(accountId);
	if (!account) {
		return { success: false, error: "Account not found" };
	}

	let client: ImapFlow | undefined;

	try {
		client = await createImapClient(account);
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
	accountId,
	mailboxPath,
	uid,
	trashMailboxPath,
}: DeleteEmailData) {
	const account = await getAccountById(accountId);
	if (!account) {
		return { success: false, error: "Account not found" };
	}

	let client: ImapFlow | undefined;
	try {
		client = await createImapClient(account);
		await client.connect();

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
