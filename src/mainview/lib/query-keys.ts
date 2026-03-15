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
