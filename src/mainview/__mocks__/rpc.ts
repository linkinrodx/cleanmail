import type { ActionStatusUpdate } from "../../shared/rpc-types";
import {
	mockFetchEmailDetail,
	mockFetchEmails,
	mockFetchMailboxes,
	mockGetActions,
} from "./handlers";

// ---------------------------------------------------------------------------
// Action-status listener stubs (no-ops in mock mode)
// ---------------------------------------------------------------------------

type ActionStatusListener = (update: ActionStatusUpdate) => void;

export function addActionStatusListener(_listener: ActionStatusListener) {}
export function removeActionStatusListener(_listener: ActionStatusListener) {}

// electroview is not needed in mock mode (no Electrobun process).
export const electroview = null;

// ---------------------------------------------------------------------------
// Mocked data-fetching exports
// ---------------------------------------------------------------------------

export const fetchEmails = mockFetchEmails;
export const fetchEmailDetail = mockFetchEmailDetail;
export const fetchMailboxes = mockFetchMailboxes;
export const getActions = mockGetActions;

// ---------------------------------------------------------------------------
// No-op stubs for write operations
// (mutations aren't part of the mock scope but must be exported so the
//  renderer compiles without errors)
// ---------------------------------------------------------------------------

const noop = async () => ({ success: true });
const noopQueued = async () => ({ queued: true });

export const getImapConfig = async () => null;
export const saveImapConfig = noop;
export const createMailbox = noop;
export const moveEmail = noop;
export const deleteEmail = noop;
export const addAction = noop;
export const removeAction = noop;
export const applyMoveAction = noopQueued;
export const applyDeleteAction = noopQueued;
