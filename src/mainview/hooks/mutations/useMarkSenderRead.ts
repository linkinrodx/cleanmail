import { useMutation, useQueryClient } from "@tanstack/react-query";
import { emailKeys, mailboxKeys, mutationKeys } from "@/lib/query-keys";
import { markSenderRead } from "@/lib/rpc";

export function useMarkSenderRead(accountId: string, mailboxPath: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: mutationKeys.markSenderRead(accountId, mailboxPath),
		mutationFn: async ({ authorEmail }: { authorEmail: string }) => {
			const res = await markSenderRead({ accountId, mailboxPath, authorEmail });
			if (!res.success) {
				throw new Error(res.error ?? "Failed to mark sender emails as read");
			}
			return res;
		},
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
