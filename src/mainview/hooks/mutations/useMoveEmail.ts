import { useMutation, useQueryClient } from "@tanstack/react-query";
import { emailKeys, mailboxKeys, mutationKeys } from "@/lib/query-keys";
import { moveEmail } from "@/lib/rpc";

export function useMoveEmail(fromMailboxPath: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: mutationKeys.moveEmail(fromMailboxPath),
		mutationFn: ({
			uid,
			toMailboxPath,
		}: {
			uid: number;
			toMailboxPath: string;
		}) => moveEmail(fromMailboxPath, toMailboxPath, uid),
		onSuccess: (_data, { toMailboxPath }) => {
			queryClient.invalidateQueries({
				queryKey: emailKeys.byMailbox(fromMailboxPath).queryKey,
			});
			queryClient.invalidateQueries({
				queryKey: emailKeys.byMailbox(toMailboxPath).queryKey,
			});
			queryClient.invalidateQueries({ queryKey: mailboxKeys._def });
		},
	});
}
