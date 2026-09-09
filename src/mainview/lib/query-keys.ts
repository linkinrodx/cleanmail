import { createQueryKeys } from "@lukemorales/query-key-factory";

export const accountKeys = createQueryKeys("accounts", {
	all: null,
});

export const emailKeys = createQueryKeys("emails", {
	byAccountAndMailbox: (accountId: string, path: string) => ({
		queryKey: [accountId, path],
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
	byAccount: (accountId: string) => ({
		queryKey: [accountId],
	}),
});

export const actionKeys = createQueryKeys("actions", {
	byAccount: (accountId?: string) => ({
		queryKey: [accountId ?? "all"],
	}),
});

export const mutationKeys = {
	addAction: () => ["actions", "add"],
	removeAction: () => ["actions", "remove"],
	applyDeleteAction: (accountId: string) => [
		"actions",
		accountId,
		"apply-delete",
	],
	applyMoveAction: (accountId: string) => ["actions", accountId, "apply-move"],
	createMailbox: (accountId: string) => ["mailboxes", accountId, "create"],
	deleteEmail: (accountId: string, mailboxPath: string) => [
		"emails",
		accountId,
		mailboxPath,
		"delete",
	],
	moveEmail: (accountId: string, fromMailboxPath: string) => [
		"emails",
		accountId,
		fromMailboxPath,
		"move",
	],
};
