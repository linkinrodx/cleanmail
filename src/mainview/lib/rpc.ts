import { Electroview } from "electrobun/view";
import type {
	ActionStatusUpdate,
	CleanMailRPC,
	PersistedAction,
} from "../../shared/rpc-types";

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

export const getImapConfig = () => rpc.request.getImapConfig();
export const saveImapConfig = (params: {
	host: string;
	port: number;
	username: string;
	password: string;
}) => rpc.request.saveImapConfig(params);
export const fetchEmails = (params: {
	mailboxPath: string;
	page?: number;
	itemsPerPage?: number;
	from?: string;
}) => rpc.request.fetchEmails(params);
export const fetchMailboxes = () => rpc.request.fetchMailboxes();
export const createMailbox = (name: string) =>
	rpc.request.createMailbox({ name });
export const deleteEmail = (
	mailboxPath: string,
	uid: number,
	trashMailboxPath?: string,
) => rpc.request.deleteEmail({ mailboxPath, uid, trashMailboxPath });
export const moveEmail = (
	fromMailboxPath: string,
	toMailboxPath: string,
	uid: number,
) => rpc.request.moveEmail({ fromMailboxPath, toMailboxPath, uid });

export const getActions = () => rpc.request.getActions();
export const addAction = (action: PersistedAction) =>
	rpc.request.addAction(action);
export const removeAction = (createdAt: string) =>
	rpc.request.removeAction({ createdAt });

export const applyMoveAction = (params: {
	jobId: string;
	authorEmail: string;
	fromMailboxPath: string;
	toMailboxPath: string;
}) => rpc.request.applyMoveAction(params);

export const applyDeleteAction = (params: {
	jobId: string;
	authorEmail: string;
	mailboxPath: string;
}) => rpc.request.applyDeleteAction(params);

export const fetchEmailDetail = (params: {
	mailboxPath: string;
	uid: number;
}) => rpc.request.fetchEmailDetail(params);
