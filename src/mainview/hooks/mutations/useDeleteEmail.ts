import { useMutation, useQueryClient } from "@tanstack/react-query";
import { emailKeys, mailboxKeys, mutationKeys } from "@/lib/query-keys";
import { deleteEmail } from "@/lib/rpc";

export function useDeleteEmail(
	accountId: string,
	mailboxPath: string,
	trashMailboxPath?: string,
) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: mutationKeys.deleteEmail(accountId, mailboxPath),
		mutationFn: (uid: number) =>
			deleteEmail({ accountId, mailboxPath, uid, trashMailboxPath }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: emailKeys.byAccountAndMailbox(accountId, mailboxPath)
					.queryKey,
			});

			if (
				trashMailboxPath &&
				trashMailboxPath.toLowerCase() !== mailboxPath.toLowerCase()
			) {
				queryClient.invalidateQueries({
					queryKey: emailKeys.byAccountAndMailbox(accountId, trashMailboxPath)
						.queryKey,
				});
			}

			queryClient.invalidateQueries({
				queryKey: mailboxKeys.byAccount(accountId).queryKey,
			});
		},
	});
}
