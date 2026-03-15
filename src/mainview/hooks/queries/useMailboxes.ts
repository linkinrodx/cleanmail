import { useQuery } from "@tanstack/react-query";
import { mailboxKeys } from "@/lib/query-keys";
import { fetchMailboxes } from "@/lib/rpc";

export function useMailboxes() {
	return useQuery({
		...mailboxKeys.all,
		queryFn: fetchMailboxes,
	});
}
