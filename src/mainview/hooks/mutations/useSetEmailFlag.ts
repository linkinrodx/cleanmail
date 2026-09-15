import { useMutation, useQueryClient } from "@tanstack/react-query";
import { emailKeys, mutationKeys } from "@/lib/query-keys";
import { setEmailFlag } from "@/lib/rpc";

export function useSetEmailFlag(accountId: string, mailboxPath: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: mutationKeys.setEmailFlag(accountId, mailboxPath),
		mutationFn: ({ uid, flagged }: { uid: number; flagged: boolean }) =>
			setEmailFlag({ accountId, mailboxPath, uid, flagged }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: emailKeys.byAccountAndMailbox(accountId, mailboxPath)
					.queryKey,
			});
		},
	});
}
