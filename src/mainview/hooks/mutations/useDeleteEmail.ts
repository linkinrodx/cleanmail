import { useMutation, useQueryClient } from "@tanstack/react-query";
import { emailKeys, mailboxKeys, mutationKeys } from "@/lib/query-keys";
import { deleteEmail } from "@/lib/rpc";

export function useDeleteEmail(mailboxPath: string, trashMailboxPath?: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: mutationKeys.deleteEmail(mailboxPath),
		mutationFn: (uid: number) =>
			deleteEmail(mailboxPath, uid, trashMailboxPath),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: emailKeys.byMailbox(mailboxPath).queryKey,
			});
			if (
				trashMailboxPath &&
				trashMailboxPath.toLowerCase() !== mailboxPath.toLowerCase()
			) {
				queryClient.invalidateQueries({
					queryKey: emailKeys.byMailbox(trashMailboxPath).queryKey,
				});
			}
			queryClient.invalidateQueries({ queryKey: mailboxKeys._def });
		},
	});
}
