import { useMutation, useQueryClient } from "@tanstack/react-query";
import { actionKeys, mutationKeys } from "@/lib/query-keys";
import { removeAction } from "@/lib/rpc";

export function useRemoveAction() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: mutationKeys.removeAction(),
		mutationFn: (id: string) => removeAction(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: actionKeys._def });
		},
	});
}
