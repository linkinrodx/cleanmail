import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	emailKeys,
	imapConfigKeys,
	mailboxKeys,
	mutationKeys,
} from "@/lib/query-keys";
import { saveImapConfig } from "@/lib/rpc";

export function useSaveImapConfig() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: mutationKeys.saveImapConfig(),
		mutationFn: saveImapConfig,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: imapConfigKeys._def });
			queryClient.invalidateQueries({ queryKey: emailKeys._def });
			queryClient.invalidateQueries({ queryKey: mailboxKeys._def });
		},
	});
}
