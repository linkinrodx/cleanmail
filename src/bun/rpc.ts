import { BrowserView } from "electrobun/bun";
import type { CleanMailRPC } from "../shared/rpc-types";
import {
	countEmailsFrom,
	rpcCreateMailbox,
	rpcDeleteEmail,
	rpcFetchEmailDetail,
	rpcFetchEmails,
	rpcFetchMailboxes,
	rpcGetImapConfig,
	rpcMoveEmail,
	rpcSaveImapConfig,
} from "./imap";
import { jobQueue, setNotifyWebview } from "./jobs";
import { readActions, writeActions } from "./storage";

export const rpc = BrowserView.defineRPC<CleanMailRPC>({
	maxRequestTime: 30 * 1000,
	handlers: {
		requests: {
			getImapConfig: rpcGetImapConfig,
			saveImapConfig: rpcSaveImapConfig,
			fetchEmails: rpcFetchEmails,
			fetchEmailDetail: rpcFetchEmailDetail,
			fetchMailboxes: rpcFetchMailboxes,
			createMailbox: rpcCreateMailbox,
			moveEmail: rpcMoveEmail,
			deleteEmail: rpcDeleteEmail,

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
			},

			removeAction: async ({ id }) => {
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
			},

			applyMoveAction: async ({
				jobId,
				authorEmail,
				fromMailboxPath,
				toMailboxPath,
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

// Wire up the webview notifier now that rpc is defined
setNotifyWebview((update) => rpc.send.actionStatusUpdate(update));
