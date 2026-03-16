import type { RPCSchema } from "electrobun/bun";

export type ImapConfig = {
	host: string;
	port: number;
	username: string;
};

export type SaveImapConfigData = ImapConfig & {
	password: string;
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
	| { id: string; action: "MOVE"; createdAt: string; data: MoveActionData }
	| { id: string; action: "DELETE"; createdAt: string; data: DeleteActionData };

export type FetchEmailsData = {
	mailboxPath: string;
	page?: number;
	itemsPerPage?: number;
	from?: string;
};

export type Email = {
	uid: number;
	subject: string;
	from: string;
	date: string;
	seen: boolean;
};

export type FetchEmailDetail = {
	mailboxPath: string;
	uid: number;
};

export type EmailDetail = {
	uid: number;
	subject: string;
	from: string;
	date: string;
	seen: boolean;
	/** HTML body if the email has an HTML part, otherwise null */
	htmlBody: string | null;
	/** Plain-text body */
	textBody: string | null;
};

export type Mailbox = {
	path: string;
	name: string;
	delimiter: string;
	flags: string[];
	specialUse?: string;
	unreadCount: number;
};

export type MoveEmailData = {
	fromMailboxPath: string;
	toMailboxPath: string;
	uid: number;
};

export type DeleteEmailData = {
	mailboxPath: string;
	uid: number;
	trashMailboxPath?: string;
};

export type ApplyMoveActionData = {
	/** Unique job id — matches the action's id */
	jobId: string;
	authorEmail: string;
	fromMailboxPath: string;
	toMailboxPath: string;
};

export type ApplyDeleteActionData = {
	/** Unique job id — matches the action's id */
	jobId: string;
	authorEmail: string;
	mailboxPath: string;
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
				params: SaveImapConfigData;
				response: { success: boolean; error?: string };
			};
			fetchEmails: {
				params: FetchEmailsData;
				response: { emails: Email[]; total: number; error?: string };
			};
			fetchEmailDetail: {
				params: FetchEmailDetail;
				response: { email: EmailDetail | null; error?: string };
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
				params: DeleteEmailData;
				response: { success: boolean; error?: string };
			};
			moveEmail: {
				params: MoveEmailData;
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
				params: { id: string };
				response: { success: boolean; error?: string };
			};
			/**
			 * Enqueue a batch move-all job.
			 * Returns immediately (202-style) — progress is reported via the
			 * `actionStatusUpdate` webview message.
			 */
			applyMoveAction: {
				params: ApplyMoveActionData;
				response: { queued: boolean; error?: string };
			};
			/**
			 * Enqueue a batch delete-all job.
			 * Returns immediately (202-style) — progress is reported via the
			 * `actionStatusUpdate` webview message.
			 */
			applyDeleteAction: {
				params: ApplyDeleteActionData;
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
