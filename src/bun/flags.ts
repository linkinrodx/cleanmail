import type { ImapFlow } from "imapflow";
import type {
	MarkEmailReadData,
	MarkSenderReadData,
	SetEmailFlagData,
} from "../shared/rpc-types";
import { createImapClient, findUidsByExactSender } from "./imap";
import { invalidateAccessTokenOnAuthFailure } from "./oauth";
import { getAccountById } from "./storage";

/**
 * UIDs flagged per `messageFlagsAdd` call. Small batches keep a single command
 * under the server's sequence-list limits when a sender has thousands of
 * messages — matches `BATCH_SIZE = 200` used by the bulk job queue (jobs.ts).
 */
const BATCH_SIZE = 200;

/** Add or remove the `\Seen` flag on a single message. */
export async function rpcMarkEmailRead({
	accountId,
	mailboxPath,
	uid,
	seen,
}: MarkEmailReadData): Promise<{ success: boolean; error?: string }> {
	const account = await getAccountById(accountId);
	if (!account) {
		return { success: false, error: "Account not found" };
	}

	let client: ImapFlow | undefined;
	try {
		client = await createImapClient(account);
		await client.connect();
		const lock = await client.getMailboxLock(mailboxPath);
		try {
			const uids = [uid];
			if (seen) {
				await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
			} else {
				await client.messageFlagsRemove(uids, ["\\Seen"], { uid: true });
			}
		} finally {
			lock.release();
		}
		await client.logout();
		return { success: true };
	} catch (err) {
		invalidateAccessTokenOnAuthFailure(account, err);
		const m = err instanceof Error ? err.message : String(err);
		try {
			await client?.logout();
		} catch {
			// ignore logout errors
		}
		return { success: false, error: m };
	}
}

/** Add or remove the `\Flagged` (star) flag on a single message. */
export async function rpcSetEmailFlag({
	accountId,
	mailboxPath,
	uid,
	flagged,
}: SetEmailFlagData): Promise<{ success: boolean; error?: string }> {
	const account = await getAccountById(accountId);
	if (!account) {
		return { success: false, error: "Account not found" };
	}

	let client: ImapFlow | undefined;
	try {
		client = await createImapClient(account);
		await client.connect();
		const lock = await client.getMailboxLock(mailboxPath);
		try {
			const uids = [uid];
			if (flagged) {
				await client.messageFlagsAdd(uids, ["\\Flagged"], { uid: true });
			} else {
				await client.messageFlagsRemove(uids, ["\\Flagged"], { uid: true });
			}
		} finally {
			lock.release();
		}
		await client.logout();
		return { success: true };
	} catch (err) {
		invalidateAccessTokenOnAuthFailure(account, err);
		const m = err instanceof Error ? err.message : String(err);
		try {
			await client?.logout();
		} catch {
			// ignore logout errors
		}
		return { success: false, error: m };
	}
}

/**
 * Bulk add `\Seen` to every message sent by `authorEmail` in the mailbox.
 * Uses `findUidsByExactSender` in `imap.ts` so the count matches
 * `countEmailsFrom` and bulk actions (move/delete) apply to the same UID set.
 */
export async function rpcMarkSenderRead({
	accountId,
	mailboxPath,
	authorEmail,
}: MarkSenderReadData): Promise<{
	success: boolean;
	updatedCount?: number;
	error?: string;
}> {
	const account = await getAccountById(accountId);
	if (!account) {
		return { success: false, updatedCount: 0, error: "Account not found" };
	}

	let client: ImapFlow | undefined;
	try {
		client = await createImapClient(account);
		await client.connect();
		const lock = await client.getMailboxLock(mailboxPath);
		let updatedCount = 0;
		try {
			const exactUids = await findUidsByExactSender(client, authorEmail);
			for (let i = 0; i < exactUids.length; i += BATCH_SIZE) {
				const batch = exactUids.slice(i, i + BATCH_SIZE);
				await client.messageFlagsAdd(batch, ["\\Seen"], { uid: true });
				updatedCount += batch.length;
			}
		} finally {
			lock.release();
		}
		await client.logout();
		return { success: true, updatedCount };
	} catch (err) {
		invalidateAccessTokenOnAuthFailure(account, err);
		const m = err instanceof Error ? err.message : String(err);
		try {
			await client?.logout();
		} catch {
			// ignore logout errors
		}
		return { success: false, updatedCount: 0, error: m };
	}
}
