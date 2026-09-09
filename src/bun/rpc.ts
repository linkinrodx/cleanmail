import { BrowserView } from "electrobun/bun";
import type { CleanMailRPC } from "../shared/rpc-types";
import {
	rpcCreateMailbox,
	rpcDeleteEmail,
	rpcFetchEmailDetail,
	rpcFetchEmails,
	rpcFetchMailboxes,
	rpcMoveEmail,
} from "./imap";
import { setNotifyWebview } from "./jobs";
import {
	rpcAddAction,
	rpcApplyDeleteAction,
	rpcApplyMoveAction,
	rpcGetActions,
	rpcRemoveAction,
} from "./actions";
import {
	rpcListAccounts,
	rpcGetAccount,
	rpcAddAccountPassword,
	rpcBeginOAuth,
	rpcCompleteOAuth,
	rpcRemoveAccount,
} from "./accounts";

export const rpc = BrowserView.defineRPC<CleanMailRPC>({
	maxRequestTime: 30 * 1000,
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
