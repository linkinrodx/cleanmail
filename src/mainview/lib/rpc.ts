import { Electroview } from "electrobun/view";
import type { ActionStatusUpdate, CleanMailRPC } from "../../shared/rpc-types";

type ActionStatusListener = (update: ActionStatusUpdate) => void;

const actionStatusListeners = new Set<ActionStatusListener>();

export function addActionStatusListener(listener: ActionStatusListener) {
	actionStatusListeners.add(listener);
}

export function removeActionStatusListener(listener: ActionStatusListener) {
	actionStatusListeners.delete(listener);
}

const rpc = Electroview.defineRPC<CleanMailRPC>({
	maxRequestTime: 30 * 1000,
	handlers: {
		requests: {},
		messages: {
			actionStatusUpdate: (update) => {
				for (const listener of actionStatusListeners) {
					listener(update);
				}
			},
		},
	},
});

export const electroview = new Electroview({ rpc });

export const getImapConfig = rpc.request.getImapConfig;
export const saveImapConfig = rpc.request.saveImapConfig;

export const fetchEmails = rpc.request.fetchEmails;
export const fetchEmailDetail = rpc.request.fetchEmailDetail;

export const fetchMailboxes = rpc.request.fetchMailboxes;
export const createMailbox = (name: string) =>
	rpc.request.createMailbox({ name });

export const moveEmail = rpc.request.moveEmail;
export const deleteEmail = rpc.request.deleteEmail;

export const getActions = rpc.request.getActions;
export const addAction = rpc.request.addAction;
export const removeAction = (id: string) => rpc.request.removeAction({ id });

export const applyMoveAction = rpc.request.applyMoveAction;
export const applyDeleteAction = rpc.request.applyDeleteAction;
