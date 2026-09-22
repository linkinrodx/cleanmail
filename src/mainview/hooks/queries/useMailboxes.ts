import { useQuery } from "@tanstack/react-query";
import { mailboxKeys } from "@/lib/query-keys";
import { fetchMailboxes } from "@/lib/rpc";

export function useMailboxes(accountId: string | null) {
	return useQuery({
		...mailboxKeys.byAccount(accountId ?? ""),
		queryFn: () => fetchMailboxes(accountId as string),
		enabled: accountId !== null,
		staleTime: 5 * 60 * 1000,
	});
}
