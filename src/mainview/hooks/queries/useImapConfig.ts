import { useQuery } from "@tanstack/react-query";
import { imapConfigKeys } from "@/lib/query-keys";
import { getImapConfig } from "@/lib/rpc";

export function useImapConfig() {
	return useQuery({
		...imapConfigKeys.all,
		queryFn: getImapConfig,
	});
}
