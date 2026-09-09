import { useMutation, useQueryClient } from "@tanstack/react-query";
import { accountKeys } from "@/lib/query-keys";
import { removeAccount } from "@/lib/rpc";

export function useRemoveAccount() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: ["accounts", "remove"],
		mutationFn: removeAccount,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: accountKeys._def });
		},
	});
}
