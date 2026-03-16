import { useQuery } from "@tanstack/react-query";
import { emailKeys } from "@/lib/query-keys";
import { fetchEmailDetail } from "@/lib/rpc";

export function useEmailDetail(
	mailboxPath: string,
	uid: number | null,
	enabled = true,
) {
	return useQuery({
		// biome-ignore lint/style/noNonNullAssertion: possibly null but ignored
		...emailKeys.byMailbox(mailboxPath)._ctx.detail(uid!),
		// biome-ignore lint/style/noNonNullAssertion: non null here
		queryFn: () => fetchEmailDetail({ mailboxPath, uid: uid! }),
		enabled: enabled && uid !== null,
	});
}
