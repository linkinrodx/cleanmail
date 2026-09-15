import type { ImapFlow } from "imapflow";
import type { Email, FetchSenderEmailsData } from "../shared/rpc-types";
import { createImapClient, findUidsByExactSender } from "./imap";
import { getAccountById } from "./storage";

const DEFAULT_ITEMS_PER_PAGE = 20;

/**
 * Return the paginated message list for a single sender using an EXACT address
 * match (via `findUidsByExactSender`). This makes the group-detail page's list
 * and `total` agree with the suggestion scan (which groups by exact
 * `envelope.from[0].address`) and with the bulk actions — unlike `fetchEmails`'
 * `search({ from })`, which is a substring/header match and over-counts.
 */
export async function rpcFetchSenderEmails({
	accountId,
	mailboxPath,
	authorEmail,
	page = 1,
	itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
}: FetchSenderEmailsData): Promise<{
	emails: Email[];
	total: number;
	error?: string;
}> {
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
		let total = 0;

		try {
			const exactUids = await findUidsByExactSender(client, authorEmail);
			total = exactUids.length;

			const offset = (page - 1) * itemsPerPage;
			const pageUids = exactUids
				.slice()
				.reverse()
				.slice(offset, offset + itemsPerPage);

			if (pageUids.length > 0) {
				for await (const msg of client.fetch(
					{ uid: pageUids.join(",") },
					{ uid: true, envelope: true, flags: true },
					{ uid: true },
				)) {
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
						flagged: msg.flags?.has("\\Flagged") ?? false,
					});
				}
				emails.sort(
					(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
				);
			}
		} finally {
			lock.release();
		}

		await client.logout();
		return { emails, total };
	} catch (err) {
		const m = err instanceof Error ? err.message : String(err);
		try {
			await client?.logout();
		} catch {
			// ignore logout errors
		}
		return { emails: [], total: 0, error: m };
	}
}
