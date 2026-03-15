import { useMutation, useQueryClient } from "@tanstack/react-query";
import { actionKeys } from "@/lib/query-keys";
import { removeAction } from "@/lib/rpc";

export function useRemoveAction() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (createdAt: string) => removeAction(createdAt),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: actionKeys._def });
		},
	});
}
