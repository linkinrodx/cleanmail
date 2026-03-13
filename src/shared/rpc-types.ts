import type { RPCSchema } from "electrobun/bun";

export type ImapConfig = {
	host: string;
	port: number;
	username: string;
};

export type Email = {
	uid: number;
	subject: string;
	from: string;
	date: string;
	seen: boolean;
};

export type CleanMailRPC = {
	bun: RPCSchema<{
		requests: {
			getImapConfig: {
				params: void;
				response: ImapConfig | null;
			};
			saveImapConfig: {
				params: {
					host: string;
					port: number;
					username: string;
					password: string;
				};
				response: { success: boolean; error?: string };
			};
			fetchEmails: {
				params: void;
				response: { emails: Email[]; error?: string };
			};
		};
		messages: Record<never, never>;
	}>;
	webview: RPCSchema<{
		requests: Record<never, never>;
		messages: Record<never, never>;
	}>;
};
