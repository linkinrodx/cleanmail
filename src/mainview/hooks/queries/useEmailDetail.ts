import { useQuery } from "@tanstack/react-query";
import { emailKeys } from "@/lib/query-keys";
import { fetchEmailDetail } from "@/lib/rpc";

export function useEmailDetail(
	accountId: string,
	mailboxPath: string,
	uid: number | null,
	enabled = true,
) {
	return useQuery({
		...emailKeys
			.byAccountAndMailbox(accountId, mailboxPath)
			._ctx.detail(uid ?? 0),
		queryFn: async () => {
			const result = await fetchEmailDetail({
				accountId,
				mailboxPath,
				uid: uid ?? 0,
			});
			if (result.error) {
				throw new Error(result.error);
			}
			return result;
		},
		enabled: enabled && uid !== null,
		staleTime: 5 * 60 * 1000,
	});
}
