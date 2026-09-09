import { useQuery } from "@tanstack/react-query";
import { actionKeys } from "@/lib/query-keys";
import { getActions } from "@/lib/rpc";
import type { PersistedAction } from "../../../shared/rpc-types";

export function useActions(accountId?: string) {
	const { data, isLoading } = useQuery({
		...actionKeys.byAccount(accountId),
		queryFn: async () => {
			const result = await getActions(accountId);

			// Sort descending by createdAt so the most recent action appears first
			const sorted = [...result.actions].sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			return sorted;
		},
	});

	return {
		actions: (data as PersistedAction[] | undefined) ?? [],
		isLoading,
	};
}
