import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mailboxKeys, mutationKeys } from "@/lib/query-keys";
import { createMailbox } from "@/lib/rpc";

export function useCreateMailbox() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: mutationKeys.createMailbox(),
		mutationFn: (name: string) => createMailbox(name),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: mailboxKeys._def });
		},
	});
}
