import { useMutation, useQueryClient } from "@tanstack/react-query";
import { emailKeys, mailboxKeys, mutationKeys } from "@/lib/query-keys";
import { markEmailRead } from "@/lib/rpc";

export function useMarkEmailRead(accountId: string, mailboxPath: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: mutationKeys.markEmailRead(accountId, mailboxPath),
		mutationFn: ({ uid, seen }: { uid: number; seen: boolean }) =>
			markEmailRead({ accountId, mailboxPath, uid, seen }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: emailKeys.byAccountAndMailbox(accountId, mailboxPath)
					.queryKey,
			});
			queryClient.invalidateQueries({
				queryKey: mailboxKeys.byAccount(accountId).queryKey,
			});
		},
	});
}
