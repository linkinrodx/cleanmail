import type {
	ActionStatusUpdate,
	OAuthCompleteMessage,
} from "../../shared/rpc-types";
import {
	mockBeginOAuth,
	mockCompleteOAuth,
	mockFetchEmailDetail,
	mockFetchEmails,
	mockFetchMailboxes,
	mockFetchSenderEmails,
	mockGetActions,
	mockGroupEmails,
} from "./handlers";

// ---------------------------------------------------------------------------
// Listener stubs (no-ops in mock mode)
// ---------------------------------------------------------------------------

type ActionStatusListener = (update: ActionStatusUpdate) => void;
type OAuthCompleteListener = (msg: OAuthCompleteMessage) => void;
type GroupScanListener = (progress: unknown) => void;

export function addActionStatusListener(_listener: ActionStatusListener) {}
export function removeActionStatusListener(_listener: ActionStatusListener) {}
export function addOAuthCompleteListener(_listener: OAuthCompleteListener) {}
export function removeOAuthCompleteListener(_listener: OAuthCompleteListener) {}
export function addGroupScanListener(_listener: GroupScanListener) {}
export function removeGroupScanListener(_listener: GroupScanListener) {}

// electroview is not needed in mock mode (no Electrobun process).
export const electroview = null;

// ---------------------------------------------------------------------------
// Account management (no-ops in mock mode)
// ---------------------------------------------------------------------------

export const listAccounts = async () => ({ accounts: [] });
export const getAccount = async () => null;
export const addAccountPassword = async () => ({ success: true });
export const beginOAuth = mockBeginOAuth;
export const completeOAuth = mockCompleteOAuth;
export const removeAccount = async () => ({ success: true });

// ---------------------------------------------------------------------------
// Mocked data-fetching exports
// ---------------------------------------------------------------------------

export const fetchEmails = mockFetchEmails;
export const fetchEmailDetail = mockFetchEmailDetail;
export const fetchSenderEmails = mockFetchSenderEmails;
export const fetchMailboxes = mockFetchMailboxes;
export const getActions = mockGetActions;
export const getSuggestions = mockGroupEmails;
export const startGroupScan = async () => ({ started: false });
export const cancelGroupScan = async () => ({ cancelled: true });

// ---------------------------------------------------------------------------
// No-op stubs for write operations
// (mutations aren't part of the mock scope but must be exported so the
//  renderer compiles without errors)
// ---------------------------------------------------------------------------

const noop = async () => ({ success: true });
const noopQueued = async () => ({ queued: true });

export const createMailbox = noop;
export const moveEmail = noop;
export const deleteEmail = noop;
export const addAction = noop;
export const removeAction = noop;
export const applyMoveAction = noopQueued;
export const applyDeleteAction = noopQueued;
export const markEmailRead = noop;
export const setEmailFlag = noop;
export const markSenderRead = async () => ({ success: true, updatedCount: 0 });
export const invalidateSuggestion = noop;
