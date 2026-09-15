import { BrowserView } from "electrobun/bun";
import type { CleanMailRPC } from "../shared/rpc-types";
import {
	rpcAddAccountPassword,
	rpcBeginOAuth,
	rpcCompleteOAuth,
	rpcGetAccount,
	rpcListAccounts,
	rpcRemoveAccount,
} from "./accounts";
import {
	rpcAddAction,
	rpcApplyDeleteAction,
	rpcApplyMoveAction,
	rpcGetActions,
	rpcRemoveAction,
} from "./actions";
import { rpcMarkEmailRead, rpcMarkSenderRead, rpcSetEmailFlag } from "./flags";
import {
	rpcCancelGroupScan,
	rpcGetSuggestions,
	rpcInvalidateSuggestion,
	rpcStartGroupScan,
	setScanNotifier,
} from "./groupScan";
import {
	rpcCreateMailbox,
	rpcDeleteEmail,
	rpcFetchEmailDetail,
	rpcFetchEmails,
	rpcFetchMailboxes,
	rpcMoveEmail,
} from "./imap";
import { setNotifyWebview } from "./jobs";
import { rpcFetchSenderEmails } from "./senderEmails";

export const rpc = BrowserView.defineRPC<CleanMailRPC>({
	// Suggestions scans run as a background job (see groupScan.ts) — they no
	// longer block an RPC. Keep generous headroom for the remaining IMAP
	// batches so they don't time out.
	maxRequestTime: 120 * 1000,
	handlers: {
		requests: {
			listAccounts: rpcListAccounts,
			getAccount: rpcGetAccount,
			addAccountPassword: rpcAddAccountPassword,
			beginOAuth: rpcBeginOAuth,
			completeOAuth: rpcCompleteOAuth,
			removeAccount: rpcRemoveAccount,
			fetchEmails: rpcFetchEmails,
			fetchEmailDetail: rpcFetchEmailDetail,
			fetchSenderEmails: rpcFetchSenderEmails,
			getSuggestions: rpcGetSuggestions,
			startGroupScan: rpcStartGroupScan,
			cancelGroupScan: rpcCancelGroupScan,
			invalidateSuggestion: rpcInvalidateSuggestion,
			markEmailRead: rpcMarkEmailRead,
			setEmailFlag: rpcSetEmailFlag,
			markSenderRead: rpcMarkSenderRead,
			fetchMailboxes: rpcFetchMailboxes,
			createMailbox: rpcCreateMailbox,
			moveEmail: rpcMoveEmail,
			deleteEmail: rpcDeleteEmail,
			getActions: rpcGetActions,
			addAction: rpcAddAction,
			removeAction: rpcRemoveAction,
			applyMoveAction: rpcApplyMoveAction,
			applyDeleteAction: rpcApplyDeleteAction,
		},
	},
});

setNotifyWebview((update) => rpc.send.actionStatusUpdate(update));
setScanNotifier((p) => rpc.send.groupScanProgress(p));
