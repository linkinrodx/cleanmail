import { Electroview } from "electrobun/view";
import type { CleanMailRPC, PersistedAction } from "../../shared/rpc-types";

const rpc = Electroview.defineRPC<CleanMailRPC>({
	handlers: {
		requests: {},
		messages: {},
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
export const fetchEmails = (mailboxPath: string) =>
	rpc.request.fetchEmails({ mailboxPath });
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
