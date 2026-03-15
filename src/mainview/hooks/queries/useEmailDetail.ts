import { useQuery } from "@tanstack/react-query";
import { emailKeys } from "@/lib/query-keys";
import { fetchEmailDetail } from "@/lib/rpc";

export function useEmailDetail(
	mailboxPath: string,
	uid: number | null,
	enabled = true,
) {
	return useQuery({
		...emailKeys.byMailbox(mailboxPath)._ctx.detail(uid ?? 0),
		queryFn: () => fetchEmailDetail({ mailboxPath, uid: uid! }),
		enabled: enabled && uid !== null,
	});
}
