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
				params: { mailboxPath: string };
				response: { emails: Email[]; error?: string };
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
		};
		messages: Record<never, never>;
	}>;
	webview: RPCSchema<{
		requests: Record<never, never>;
		messages: Record<never, never>;
	}>;
};
