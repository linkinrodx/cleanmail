import { BrowserView } from "electrobun/bun";
import type { CleanMailRPC } from "../shared/rpc-types";
import {
	rpcCreateMailbox,
	rpcDeleteEmail,
	rpcFetchEmailDetail,
	rpcFetchEmails,
	rpcFetchMailboxes,
	rpcGetImapConfig,
	rpcMoveEmail,
	rpcSaveImapConfig,
} from "./imap";
import { setNotifyWebview } from "./jobs";
import {
	rpcAddAction,
	rpcApplyDeleteAction,
	rpcApplyMoveAction,
	rpcGetActions,
	rpcRemoveAction,
} from "./actions";

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
			getActions: rpcGetActions,
			addAction: rpcAddAction,
			removeAction: rpcRemoveAction,
			applyMoveAction: rpcApplyMoveAction,
			applyDeleteAction: rpcApplyDeleteAction,
		},
	},
});

// Wire up the webview notifier now that rpc is defined
setNotifyWebview((update) => rpc.send.actionStatusUpdate(update));
