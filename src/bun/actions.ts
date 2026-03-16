import type { PersistedAction } from "src/shared/rpc-types";
import { countEmailsFrom } from "./imap";
import { jobQueue } from "./jobs";
import { readActions, writeActions } from "./storage";

export const rpcGetActions = async () => {
	try {
		const actions = await readActions();
		return { actions };
	} catch (err) {
		return {
			actions: [],
			error: err instanceof Error ? err.message : String(err),
		};
	}
};

export const rpcAddAction = async (newAction: PersistedAction) => {
	try {
		// Only persist the action when at least 1 other email in the
		// relevant mailbox matches the same sender filter.
		const mailboxToSearch =
			newAction.action === "MOVE"
				? newAction.data.fromMailboxPath
				: newAction.data.mailboxPath;

		const matchCount = await countEmailsFrom({
			mailboxPath: mailboxToSearch,
			authorEmail: newAction.data.authorEmail,
		});

		if (matchCount < 1) {
			return { success: true };
		}

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
};

export const rpcRemoveAction = async ({ id }: { id: string }) => {
	try {
		const actions = await readActions();
		const filtered = actions.filter((a) => a.id !== id);
		await writeActions(filtered);
		return { success: true };
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
};

export const rpcApplyMoveAction = async ({
	jobId,
	authorEmail,
	fromMailboxPath,
	toMailboxPath,
}: {
	jobId: string;
	authorEmail: string;
	fromMailboxPath: string;
	toMailboxPath: string;
}) => {
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
};

export const rpcApplyDeleteAction = async ({
	jobId,
	authorEmail,
	mailboxPath,
}: {
	jobId: string;
	authorEmail: string;
	mailboxPath: string;
}) => {
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
};
