import { useQuery } from "@tanstack/react-query";
import { accountKeys } from "@/lib/query-keys";
import { listAccounts } from "@/lib/rpc";

export function useAccounts() {
	const { data, isLoading, isError, error, refetch } = useQuery({
		...accountKeys.all,
		queryFn: async () => {
			const result = await listAccounts();
			if (result.error) {
				throw new Error(result.error);
			}
			return result;
		},
	});

	return {
		accounts: data?.accounts ?? [],
		isLoading,
		isError,
		error,
		refetch,
	};
}
