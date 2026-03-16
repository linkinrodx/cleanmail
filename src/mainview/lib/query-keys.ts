import { createQueryKeys } from "@lukemorales/query-key-factory";

export const imapConfigKeys = createQueryKeys("imap-config", {
	all: null,
});

export const emailKeys = createQueryKeys("emails", {
	byMailbox: (path: string) => ({
		queryKey: [path],
		contextQueries: {
			filtered: (filters: {
				page?: number;
				itemsPerPage?: number;
				from?: string;
			}) => ({
				queryKey: [filters],
			}),
			detail: (uid: number) => ({
				queryKey: [uid],
			}),
		},
	}),
});

export const mailboxKeys = createQueryKeys("mailboxes", {
	all: null,
});

export const actionKeys = createQueryKeys("actions", {
	all: null,
});

export const mutationKeys = {
	saveImapConfig: () => ["imap-config", "save"],
	addAction: () => ["actions", "add"],
	removeAction: () => ["actions", "remove"],
	applyDeleteAction: () => ["actions", "apply-delete"],
	applyMoveAction: () => ["actions", "apply-move"],
	createMailbox: () => ["mailboxes", "create"],
	deleteEmail: (mailboxPath: string) => ["emails", mailboxPath, "delete"],
	moveEmail: (fromMailboxPath: string) => ["emails", fromMailboxPath, "move"],
};
