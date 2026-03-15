import type { ActionStatusUpdate } from "../shared/rpc-types";
import { createImapClient } from "./imap";

// ---------------------------------------------------------------------------
// Background job types
// ---------------------------------------------------------------------------

export type ApplyMoveJob = {
	type: "move";
	jobId: string;
	authorEmail: string;
	fromMailboxPath: string;
	toMailboxPath: string;
};

export type ApplyDeleteJob = {
	type: "delete";
	jobId: string;
	authorEmail: string;
	mailboxPath: string;
};

export type ApplyJob = ApplyMoveJob | ApplyDeleteJob;

// ---------------------------------------------------------------------------
// Job queue
// ---------------------------------------------------------------------------

export const jobQueue: ApplyJob[] = [];

// ---------------------------------------------------------------------------
// Webview notifier (injected after rpc is initialised)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Job processor
// ---------------------------------------------------------------------------

export async function processJob(job: ApplyJob) {
	notifyWebview({ jobId: job.jobId, status: "running" });

	let client: import("imapflow").ImapFlow | undefined;
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

// ---------------------------------------------------------------------------
// Background interval — process one job per second
// ---------------------------------------------------------------------------

setInterval(async () => {
	if (jobQueue.length > 0) {
		const job = jobQueue.shift()!;
		await processJob(job);
	}
}, 1000);
