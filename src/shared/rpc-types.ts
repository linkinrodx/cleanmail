import type { RPCSchema } from "electrobun/bun";

export type ImapConfig = {
	host: string;
	port: number;
	username: string;
};

export type MoveActionData = {
	uid: number;
	authorEmail: string;
	fromMailboxPath: string;
	toMailboxPath: string;
};

export type DeleteActionData = {
	uid: number;
	authorEmail: string;
	mailboxPath: string;
};

export type PersistedAction =
	| { action: "MOVE"; createdAt: string; data: MoveActionData }
	| { action: "DELETE"; createdAt: string; data: DeleteActionData };

export type Email = {
	uid: number;
	subject: string;
	from: string;
	date: string;
	seen: boolean;
};

export type Mailbox = {
	path: string;
	name: string;
	delimiter: string;
	flags: string[];
	specialUse?: string;
	unreadCount: number;
};

export type ActionJobStatus = "pending" | "running" | "success" | "error";

export type ActionStatusUpdate = {
	/** Unique job identifier — equals the action's createdAt timestamp */
	jobId: string;
	status: ActionJobStatus;
	error?: string;
};

export type CleanMailRPC = {
	bun: RPCSchema<{
		requests: {
			getImapConfig: {
				params: void;
				response: ImapConfig | null;
			};
			saveImapConfig: {
				params: {
					host: string;
					port: number;
					username: string;
					password: string;
				};
				response: { success: boolean; error?: string };
			};
			fetchEmails: {
				params: {
					mailboxPath: string;
					page?: number;
					itemsPerPage?: number;
					from?: string;
				};
				response: { emails: Email[]; total: number; error?: string };
			};
			fetchMailboxes: {
				params: void;
				response: { mailboxes: Mailbox[]; error?: string };
			};
			createMailbox: {
				params: { name: string };
				response: { success: boolean; error?: string };
			};
			deleteEmail: {
				params: {
					mailboxPath: string;
					uid: number;
					trashMailboxPath?: string;
				};
				response: { success: boolean; error?: string };
			};
			moveEmail: {
				params: { fromMailboxPath: string; toMailboxPath: string; uid: number };
				response: { success: boolean; error?: string };
			};
			getActions: {
				params: void;
				response: { actions: PersistedAction[]; error?: string };
			};
			addAction: {
				params: PersistedAction;
				response: { success: boolean; error?: string };
			};
			removeAction: {
				params: { createdAt: string };
				response: { success: boolean; error?: string };
			};
			/**
			 * Enqueue a batch move-all job.
			 * Returns immediately (202-style) — progress is reported via the
			 * `actionStatusUpdate` webview message.
			 */
			applyMoveAction: {
				params: {
					/** Unique job id for tracking — use the action's createdAt */
					jobId: string;
					authorEmail: string;
					fromMailboxPath: string;
					toMailboxPath: string;
				};
				response: { queued: boolean; error?: string };
			};
			/**
			 * Enqueue a batch delete-all job.
			 * Returns immediately (202-style) — progress is reported via the
			 * `actionStatusUpdate` webview message.
			 */
			applyDeleteAction: {
				params: {
					jobId: string;
					authorEmail: string;
					mailboxPath: string;
				};
				response: { queued: boolean; error?: string };
			};
		};
		messages: Record<never, never>;
	}>;
	webview: RPCSchema<{
		requests: Record<never, never>;
		messages: {
			/** Sent by the bun process when a batch job changes status */
			actionStatusUpdate: ActionStatusUpdate;
		};
	}>;
};
