import type {
	ApplyDeleteActionData,
	ApplyMoveActionData,
	PersistedAction,
} from "../shared/rpc-types";
import { countEmailsFrom } from "./imap";
import { jobQueue } from "./jobs";
import { readActions, serializeActions, writeActions } from "./storage";

export const rpcGetActions = async ({ accountId }: { accountId?: string }) => {
	try {
		const actions = await readActions();
		const filtered = accountId
			? actions.filter((a) => a.data.accountId === accountId)
			: actions;
		return { actions: filtered };
	} catch (err) {
		return {
			actions: [],
			error: err instanceof Error ? err.message : String(err),
		};
	}
};

export const rpcAddAction = async (newAction: PersistedAction) => {
	try {
		const mailboxToSearch =
			newAction.action === "MOVE"
				? newAction.data.fromMailboxPath
				: newAction.data.mailboxPath;

		const matchResult = await countEmailsFrom({
			accountId: newAction.data.accountId,
			mailboxPath: mailboxToSearch,
			authorEmail: newAction.data.authorEmail,
		});

		// A failing count is a transient IMAP/account error, not "nothing to
		// match": surface it instead of silently dropping the user's action.
		if (matchResult.error) {
			return { success: false, error: matchResult.error };
		}

		// Genuinely zero matching messages: nothing to do, same as before.
		if (matchResult.count <= 0) {
			return { success: true };
		}

		return serializeActions(async () => {
			const actions = await readActions();

			const isDuplicate = actions.some((a) => {
				if (a.action === "MOVE" && newAction.action === "MOVE") {
					return (
						a.data.accountId === newAction.data.accountId &&
						a.data.authorEmail === newAction.data.authorEmail &&
						a.data.fromMailboxPath === newAction.data.fromMailboxPath &&
						a.data.toMailboxPath === newAction.data.toMailboxPath
					);
				}
				if (a.action === "DELETE" && newAction.action === "DELETE") {
					return (
						a.data.accountId === newAction.data.accountId &&
						a.data.authorEmail === newAction.data.authorEmail &&
						a.data.mailboxPath === newAction.data.mailboxPath
					);
				}
				return false;
			});

			if (!isDuplicate) {
				// Build a fresh array — never mutate the store's cached list in
				// place, so a failed write can't leave an unsaved action behind.
				await writeActions([...actions, newAction]);
			}

			return { success: true };
		});
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
};

export const rpcRemoveAction = async ({ id }: { id: string }) => {
	try {
		await serializeActions(async () => {
			const actions = await readActions();
			const filtered = actions.filter((a) => a.id !== id);
			await writeActions(filtered);
		});

		return { success: true };
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
};

export const rpcApplyMoveAction = async (data: ApplyMoveActionData) => {
	const alreadyQueued = jobQueue.some((j) => j.jobId === data.jobId);
	if (alreadyQueued) {
		return { queued: false, error: "Job already queued" };
	}

	jobQueue.push({
		type: "move",
		...data,
	});
	return { queued: true };
};

export const rpcApplyDeleteAction = async (data: ApplyDeleteActionData) => {
	const alreadyQueued = jobQueue.some((j) => j.jobId === data.jobId);
	if (alreadyQueued) {
		return { queued: false, error: "Job already queued" };
	}

	jobQueue.push({
		type: "delete",
		...data,
	});
	return { queued: true };
};
