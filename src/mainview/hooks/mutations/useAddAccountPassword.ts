import { useMutation, useQueryClient } from "@tanstack/react-query";
import { accountKeys } from "@/lib/query-keys";
import { addAccountPassword } from "@/lib/rpc";

export function useAddAccountPassword() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: ["accounts", "add"],
		mutationFn: addAccountPassword,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: accountKeys._def });
		},
	});
}
