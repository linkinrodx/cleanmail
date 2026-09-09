import { useMutation, useQueryClient } from "@tanstack/react-query";
import { emailKeys, mailboxKeys, mutationKeys } from "@/lib/query-keys";
import { moveEmail } from "@/lib/rpc";

export function useMoveEmail(accountId: string, fromMailboxPath: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: mutationKeys.moveEmail(accountId, fromMailboxPath),
		mutationFn: ({
			uid,
			toMailboxPath,
		}: {
			uid: number;
			toMailboxPath: string;
		}) => moveEmail({ accountId, fromMailboxPath, toMailboxPath, uid }),
		onSuccess: (_data, { toMailboxPath }) => {
			queryClient.invalidateQueries({
				queryKey: emailKeys.byAccountAndMailbox(accountId, fromMailboxPath)
					.queryKey,
			});
			queryClient.invalidateQueries({
				queryKey: emailKeys.byAccountAndMailbox(accountId, toMailboxPath)
					.queryKey,
			});
			queryClient.invalidateQueries({
				queryKey: mailboxKeys.byAccount(accountId).queryKey,
			});
		},
	});
}
