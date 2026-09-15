import { useMutation, useQueryClient } from "@tanstack/react-query";
import { emailKeys, mailboxKeys, mutationKeys } from "@/lib/query-keys";
import { markSenderRead } from "@/lib/rpc";

export function useMarkSenderRead(accountId: string, mailboxPath: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: mutationKeys.markSenderRead(accountId, mailboxPath),
		mutationFn: ({ authorEmail }: { authorEmail: string }) =>
			markSenderRead({ accountId, mailboxPath, authorEmail }),
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
