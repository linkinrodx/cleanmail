import { type QueryClient, useQuery } from "@tanstack/react-query";
import { emailKeys } from "@/lib/query-keys";
import { fetchSenderEmails } from "@/lib/rpc";
import { EMAILS_PER_PAGE } from "./useEmails";

type SenderFilters = { page?: number; itemsPerPage?: number };

/**
 * Paginated, EXACT-sender message list. Matches the Suggestion scan's per-
 * sender `count` and the bulk-action UID set, so the group-detail page's total
 * and pagination always agree with what the suggestion said.
 */
export function useSenderEmails(
	accountId: string,
	mailboxPath: string,
	authorEmail: string,
	filters: SenderFilters = {},
) {
	const { page = 1, itemsPerPage = EMAILS_PER_PAGE } = filters;
	const resolvedFilters = { authorEmail, page, itemsPerPage };

	return useQuery({
		...emailKeys
			.byAccountAndMailbox(accountId, mailboxPath)
			._ctx.sender(resolvedFilters),
		queryFn: () =>
			fetchSenderEmails({ accountId, mailboxPath, ...resolvedFilters }),
	});
}

export function prefetchSenderEmails(
	queryClient: QueryClient,
	accountId: string,
	mailboxPath: string,
	authorEmail: string,
	filters: SenderFilters = {},
) {
	const { page = 1, itemsPerPage = EMAILS_PER_PAGE } = filters;
	const resolvedFilters = { authorEmail, page, itemsPerPage };

	return queryClient.prefetchQuery({
		...emailKeys
			.byAccountAndMailbox(accountId, mailboxPath)
			._ctx.sender(resolvedFilters),
		queryFn: () =>
			fetchSenderEmails({ accountId, mailboxPath, ...resolvedFilters }),
	});
}
