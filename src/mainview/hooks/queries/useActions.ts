import { useQuery } from "@tanstack/react-query";
import { actionKeys } from "@/lib/query-keys";
import { getActions } from "@/lib/rpc";

export function useActions() {
	return useQuery({
		...actionKeys.all,
		queryFn: async () => {
			const result = await getActions();

			// Sort descending by createdAt so the most recent action appears first
			const sorted = [...result.actions].sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			return sorted;
		},
	});
}
