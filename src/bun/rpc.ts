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
import {
	rpcCreateMailbox,
	rpcDeleteEmail,
	rpcFetchEmailDetail,
	rpcFetchEmails,
	rpcFetchMailboxes,
	rpcMoveEmail,
} from "./imap";
import { setNotifyWebview } from "./jobs";
import { getMainWindow } from "./window";

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
			getWindowState: async () => {
				const w = getMainWindow();
				return {
					isMaximized: w.isMaximized(),
					isMinimized: w.isMinimized(),
					isFullScreen: w.isFullScreen(),
				};
			},
			minimizeWindow: async () => {
				getMainWindow().minimize();
				return { success: true };
			},
			toggleMaximizeWindow: async () => {
				const w = getMainWindow();
				if (w.isMaximized()) {
					w.unmaximize();
				} else {
					w.maximize();
				}
				return { success: true, isMaximized: w.isMaximized() };
			},
			closeWindow: async () => {
				getMainWindow().close();
				return { success: true };
			},
		},
	},
});

setNotifyWebview((update) => rpc.send.actionStatusUpdate(update));
