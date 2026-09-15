import type { ImapFlow } from "imapflow";
import type { ActionStatusUpdate } from "../shared/rpc-types";
import { createImapClient, findUidsByExactSender } from "./imap";
import { getAccountById, removeSenderFromSuggestionCache } from "./storage";

type ApplyMoveJob = {
	type: "move";
	jobId: string;
	accountId: string;
	authorEmail: string;
	fromMailboxPath: string;
	toMailboxPath: string;
};

type ApplyDeleteJob = {
	type: "delete";
	jobId: string;
	accountId: string;
	authorEmail: string;
	mailboxPath: string;
};

type ApplyJob = ApplyMoveJob | ApplyDeleteJob;

export const jobQueue: ApplyJob[] = [];

type NotifyFn = (update: ActionStatusUpdate) => void;

let _notify: NotifyFn = () => {};

export function setNotifyWebview(fn: NotifyFn) {
	_notify = fn;
}

export function notifyWebview(update: ActionStatusUpdate) {
	try {
		_notify(update);
	} catch {
		// webview may not be ready yet — ignore
	}
}

const processMoveJob = async (client: ImapFlow, job: ApplyMoveJob) => {
	const lock = await client.getMailboxLock(job.fromMailboxPath);
	try {
		const uids = await findUidsByExactSender(client, job.authorEmail);

		if (uids.length > 0) {
			await client.messageMove({ uid: uids.join(",") }, job.toMailboxPath, {
				uid: true,
			});
		}
	} finally {
		lock.release();
	}
};

const processDeleteJob = async (client: ImapFlow, job: ApplyDeleteJob) => {
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
		const uids = await findUidsByExactSender(client, job.authorEmail);

		if (uids.length > 0) {
			if (trashMailboxPath && !alreadyInTrash) {
				await client.messageMove({ uid: uids.join(",") }, trashMailboxPath, {
					uid: true,
				});
			} else {
				await client.messageDelete({ uid: uids.join(",") }, { uid: true });
			}
		}
	} finally {
		lock.release();
	}
};

export async function processJob(job: ApplyJob) {
	notifyWebview({ jobId: job.jobId, status: "running" });

	const account = await getAccountById(job.accountId);
	if (!account) {
		notifyWebview({
			jobId: job.jobId,
			status: "error",
			error: "Account not found",
		});
		return;
	}

	let client: ImapFlow | undefined;
	try {
		client = await createImapClient(account);
		await client.connect();

		if (job.type === "move") {
			await processMoveJob(client, job);
		} else {
			await processDeleteJob(client, job);
		}

		await client.logout();
		notifyWebview({ jobId: job.jobId, status: "success" });

		// Keep the suggestions cache consistent regardless of which screen is
		// open: drop the cleared sender so its suggestion does not linger.
		const suggestionMailbox =
			job.type === "move" ? job.fromMailboxPath : job.mailboxPath;
		await removeSenderFromSuggestionCache(
			job.accountId,
			suggestionMailbox,
			job.authorEmail,
		);
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

let jobLock = false;

setInterval(async () => {
	if (jobLock) {
		return;
	}

	const job = jobQueue.shift();
	if (job) {
		jobLock = true;
		await processJob(job);
		jobLock = false;
	}
}, 1000);
