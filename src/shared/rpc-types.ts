import type { RPCSchema } from "electrobun/bun";

// ---------------------------------------------------------------------------
// Account model (replaces the old single ImapConfig)
// ---------------------------------------------------------------------------

export type AuthMethod = "password" | "oauth2";

export type AccountProvider = "gmail" | "outlook" | "custom";

export type Account = {
	id: string; // uuid
	provider: AccountProvider;
	email: string; // visible identifier
	host: string; // imap.gmail.com | outlook.office365.com
	port: number; // 993
	authMethod: AuthMethod;
	// password: stored in keytar under `cleanmail:acct:<id>:password`
	// oauth: stored in keytar under `cleanmail:acct:<id>:oauth` (JSON)
};

export type OAuthTokens = {
	accessToken: string;
	refreshToken: string;
	/** Expiry of the access token, epoch milliseconds */
	expiresAt: number;
};

// ---------------------------------------------------------------------------
// Persisted actions — now account-scoped
// ---------------------------------------------------------------------------

export type MoveActionData = {
	accountId: string;
	uid: number;
	authorEmail: string;
	fromMailboxPath: string;
	toMailboxPath: string;
};

export type DeleteActionData = {
	accountId: string;
	uid: number;
	authorEmail: string;
	mailboxPath: string;
};

export type PersistedAction =
	| { id: string; action: "MOVE"; createdAt: string; data: MoveActionData }
	| { id: string; action: "DELETE"; createdAt: string; data: DeleteActionData };

export type FetchEmailsData = {
	accountId: string;
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
	accountId: string;
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
	accountId: string;
	fromMailboxPath: string;
	toMailboxPath: string;
	uid: number;
};

export type DeleteEmailData = {
	accountId: string;
	mailboxPath: string;
	uid: number;
	trashMailboxPath?: string;
};

export type ApplyMoveActionData = {
	/** Unique job id — matches the action's id */
	jobId: string;
	accountId: string;
	authorEmail: string;
	fromMailboxPath: string;
	toMailboxPath: string;
};

export type ApplyDeleteActionData = {
	/** Unique job id — matches the action's id */
	jobId: string;
	accountId: string;
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

// ---------------------------------------------------------------------------
// Account management RPCs
// ---------------------------------------------------------------------------

export type AddAccountPasswordParams = {
	provider: AccountProvider;
	email: string;
	host: string;
	port: number;
	password: string;
};

export type BeginOAuthParams = {
	provider: AccountProvider;
	email?: string;
};

export type BeginOAuthResult = {
	state: string;
	authUrl: string;
	error?: string;
};

export type CompleteOAuthParams = {
	state: string;
	code: string;
	provider: AccountProvider;
};

/** Push message emitted by the bun callback server once OAuth finishes. */
export type OAuthCompleteMessage =
	| { account: Account }
	| { error: string; provider?: AccountProvider };

export type CleanMailRPC = {
	bun: RPCSchema<{
		requests: {
			listAccounts: {
				// biome-ignore lint/suspicious/noConfusingVoidType: RPC request takes no parameters
				params: void;
				response: { accounts: Account[]; error?: string };
			};
			getAccount: {
				params: { id: string };
				response: Account | null;
			};
			addAccountPassword: {
				params: AddAccountPasswordParams;
				response: { success: boolean; account?: Account; error?: string };
			};
			beginOAuth: {
				params: BeginOAuthParams;
				response: BeginOAuthResult;
			};
			completeOAuth: {
				params: CompleteOAuthParams;
				response: { success: boolean; account?: Account; error?: string };
			};
			removeAccount: {
				params: { id: string };
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
				params: { accountId: string };
				response: { mailboxes: Mailbox[]; error?: string };
			};
			createMailbox: {
				params: { accountId: string; name: string };
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
				params: { accountId?: string };
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
			/** Sent by the bun process when an OAuth flow completes */
			oauthComplete: OAuthCompleteMessage;
		};
	}>;
};
