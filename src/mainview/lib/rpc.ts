import { Electroview } from "electrobun/view";
import type { CleanMailRPC } from "../../shared/rpc-types";

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
