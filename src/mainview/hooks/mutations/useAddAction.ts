import { useMutation, useQueryClient } from "@tanstack/react-query";
import { actionKeys, mutationKeys } from "@/lib/query-keys";
import { addAction } from "@/lib/rpc";
import type { PersistedAction } from "../../../shared/rpc-types";

export function useAddAction() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: mutationKeys.addAction(),
		mutationFn: (action: PersistedAction) => addAction(action),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: actionKeys._def });
		},
	});
}
