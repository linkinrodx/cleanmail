import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mailboxKeys, mutationKeys } from "@/lib/query-keys";
import { createMailbox } from "@/lib/rpc";

export function useCreateMailbox(accountId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: mutationKeys.createMailbox(accountId),
		mutationFn: (name: string) => createMailbox({ accountId, name }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: mailboxKeys.byAccount(accountId).queryKey,
			});
		},
	});
}
