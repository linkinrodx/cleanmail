import { type QueryClient, useQuery } from "@tanstack/react-query";
import { emailKeys } from "@/lib/query-keys";
import { fetchEmails } from "@/lib/rpc";

export const EMAILS_PER_PAGE = 20;

export function useEmails(
	mailboxPath: string,
	filters: { page?: number; itemsPerPage?: number; from?: string } = {},
) {
	const { page = 1, itemsPerPage = EMAILS_PER_PAGE, from } = filters;
	const resolvedFilters = { page, itemsPerPage, from };
	return useQuery({
		...emailKeys.byMailbox(mailboxPath)._ctx.filtered(resolvedFilters),
		queryFn: () => fetchEmails({ mailboxPath, ...resolvedFilters }),
	});
}

export function prefetchEmails(
	queryClient: QueryClient,
	mailboxPath: string,
	filters: { page?: number; itemsPerPage?: number; from?: string } = {},
) {
	const { page = 1, itemsPerPage = EMAILS_PER_PAGE, from } = filters;
	const resolvedFilters = { page, itemsPerPage, from };
	return queryClient.prefetchQuery({
		...emailKeys.byMailbox(mailboxPath)._ctx.filtered(resolvedFilters),
		queryFn: () => fetchEmails({ mailboxPath, ...resolvedFilters }),
	});
}
