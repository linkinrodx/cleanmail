import { Electroview } from "electrobun/view";
import type {
	ActionStatusUpdate,
	CleanMailRPC,
	GroupScanProgress,
	OAuthCompleteMessage,
} from "../../shared/rpc-types";

type ActionStatusListener = (update: ActionStatusUpdate) => void;
type OAuthCompleteListener = (msg: OAuthCompleteMessage) => void;
type GroupScanListener = (progress: GroupScanProgress) => void;

const actionStatusListeners = new Set<ActionStatusListener>();
const oauthCompleteListeners = new Set<OAuthCompleteListener>();
const groupScanListeners = new Set<GroupScanListener>();

export function addActionStatusListener(listener: ActionStatusListener) {
	actionStatusListeners.add(listener);
}

export function removeActionStatusListener(listener: ActionStatusListener) {
	actionStatusListeners.delete(listener);
}

export function addOAuthCompleteListener(listener: OAuthCompleteListener) {
	oauthCompleteListeners.add(listener);
}

export function removeOAuthCompleteListener(listener: OAuthCompleteListener) {
	oauthCompleteListeners.delete(listener);
}

export function addGroupScanListener(listener: GroupScanListener) {
	groupScanListeners.add(listener);
}

export function removeGroupScanListener(listener: GroupScanListener) {
	groupScanListeners.delete(listener);
}

const rpc = Electroview.defineRPC<CleanMailRPC>({
	maxRequestTime: 120 * 1000,
	handlers: {
		requests: {},
		messages: {
			actionStatusUpdate: (update) => {
				for (const listener of actionStatusListeners) {
					listener(update);
				}
			},
			oauthComplete: (msg) => {
				for (const listener of oauthCompleteListeners) {
					listener(msg);
				}
			},
			groupScanProgress: (progress) => {
				for (const listener of groupScanListeners) {
					listener(progress);
				}
			},
		},
	},
});

export const electroview = new Electroview({ rpc });

export const listAccounts = rpc.request.listAccounts;
export const getAccount = rpc.request.getAccount;
export const addAccountPassword = rpc.request.addAccountPassword;
export const beginOAuth = rpc.request.beginOAuth;
export const completeOAuth = rpc.request.completeOAuth;
export const removeAccount = rpc.request.removeAccount;

export const fetchEmails = rpc.request.fetchEmails;
export const fetchEmailDetail = rpc.request.fetchEmailDetail;
export const fetchSenderEmails = rpc.request.fetchSenderEmails;
export const fetchMailboxes = (accountId: string) =>
	rpc.request.fetchMailboxes({ accountId });
export const createMailbox = ({
	accountId,
	name,
}: {
	accountId: string;
	name: string;
}) => rpc.request.createMailbox({ accountId, name });

export const moveEmail = rpc.request.moveEmail;
export const deleteEmail = rpc.request.deleteEmail;
export const markEmailRead = rpc.request.markEmailRead;
export const setEmailFlag = rpc.request.setEmailFlag;
export const markSenderRead = rpc.request.markSenderRead;

export const getActions = (accountId?: string) =>
	rpc.request.getActions({ accountId });
export const addAction = rpc.request.addAction;
export const removeAction = (id: string) => rpc.request.removeAction({ id });

export const applyMoveAction = rpc.request.applyMoveAction;
export const applyDeleteAction = rpc.request.applyDeleteAction;

export const getSuggestions = rpc.request.getSuggestions;
export const startGroupScan = rpc.request.startGroupScan;
export const cancelGroupScan = rpc.request.cancelGroupScan;
export const invalidateSuggestion = rpc.request.invalidateSuggestion;
