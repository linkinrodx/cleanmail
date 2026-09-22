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
	flagged: boolean;
};

export type FetchEmailDetail = {
	accountId: string;
	mailboxPath: string;
	uid: number;
};

export type FetchSenderEmailsData = {
	accountId: string;
	mailboxPath: string;
	authorEmail: string;
	page?: number;
	itemsPerPage?: number;
};

export type EmailDetail = {
	uid: number;
	subject: string;
	from: string;
	date: string;
	seen: boolean;
	flagged: boolean;
	/** HTML body if the email has an HTML part, otherwise null */
	htmlBody: string | null;
	/** Plain-text body */
	textBody: string | null;
};

// ---------------------------------------------------------------------------
// Suggestions — sender grouping with recommended actions
// ---------------------------------------------------------------------------

export type RecommendedAction = "ARCHIVE" | "TRASH" | "DELETE" | "MARK_READ";

export type SenderGroup = {
	authorEmail: string;
	count: number;
	lastDate: string;
	sampleSubjects: string[];
	recommendedAction: RecommendedAction;
};

export type GroupEmailsParams = {
	accountId: string;
	mailboxPath: string;
	minCount?: number;
	limit?: number;
	scanCap?: number;
};

export type MarkEmailReadData = {
	accountId: string;
	mailboxPath: string;
	uid: number;
	/** true → add \Seen; false → remove \Seen */
	seen: boolean;
};

export type SetEmailFlagData = {
	accountId: string;
	mailboxPath: string;
	uid: number;
	/** true → add \Flagged; false → remove \Flagged */
	flagged: boolean;
};

export type MarkSenderReadData = {
	accountId: string;
	mailboxPath: string;
	/**
	 * Full sender address. The backend narrows with an IMAP `FROM` search but then
	 * filters to an exact, case-insensitive match on the message's
	 * `envelope.from[0].address`, so only this exact sender is marked as read.
	 */
	authorEmail: string;
};

// ---------------------------------------------------------------------------
// Suggestion scan (async background job with progress + cache)
// ---------------------------------------------------------------------------

export type GroupScanStatus = "idle" | "scanning" | "ready" | "error";

export type GroupScanPhase = "search" | "envelopes" | "done";

/**
 * Progress pushed bun → webview while a suggestion scan runs. Terminal
 * states (`ready` / `error`) also carry the final `groups` / `error`.
 */
export type GroupScanProgress = {
	accountId: string;
	mailboxPath: string;
	status: GroupScanStatus;
	phase: GroupScanPhase;
	/** Messages scanned so far. */
	scanned: number;
	/** Total messages in the scan window (0 until known). */
	total: number;
	/** Distinct senders discovered so far. */
	sendersFound: number;
	/** Final groups (populated on `ready`). */
	groups?: SenderGroup[];
	/** Cache write timestamp (ISO) when `ready`. */
	cachedAt?: string;
	/** Error detail when `status === "error"`. */
	error?: string;
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
	/**
	 * Partial progress for a running bulk job, pushed after each batch of UIDs
	 * is processed. `done` counts messages already moved/deleted; `total` is the
	 * full UID set the job resolved up front. Only present while `status` is
	 * "running"; terminal "success"/"error" frames omit it.
	 */
	progress?: { done: number; total: number };
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
			fetchSenderEmails: {
				params: FetchSenderEmailsData;
				response: { emails: Email[]; total: number; error?: string };
			};
			fetchEmailDetail: {
				params: FetchEmailDetail;
				response: { email: EmailDetail | null; error?: string };
			};
			getSuggestions: {
				params: { accountId: string; mailboxPath: string };
				response: {
					groups: SenderGroup[];
					status: GroupScanStatus;
					cachedAt: string | null;
					error?: string;
				};
			};
			startGroupScan: {
				params: { accountId: string; mailboxPath: string; force?: boolean };
				response: {
					started: boolean;
					alreadyRunning?: boolean;
					error?: string;
				};
			};
			cancelGroupScan: {
				params: { accountId: string; mailboxPath: string };
				response: { cancelled: boolean };
			};
			invalidateSuggestion: {
				params: { accountId: string; mailboxPath: string; authorEmail: string };
				response: { success: boolean; error?: string };
			};
			markEmailRead: {
				params: MarkEmailReadData;
				response: { success: boolean; error?: string };
			};
			setEmailFlag: {
				params: SetEmailFlagData;
				response: { success: boolean; error?: string };
			};
			markSenderRead: {
				params: MarkSenderReadData;
				response: { success: boolean; updatedCount?: number; error?: string };
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
			/** Sent by the bun process as a suggestion scan progresses/completes */
			groupScanProgress: GroupScanProgress;
		};
	}>;
};
