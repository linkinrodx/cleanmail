import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEmails, getImapConfig, saveImapConfig } from "../rpc";

export const imapConfigKeys = {
	all: ["imap-config"] as const,
};

export const emailKeys = {
	all: ["emails"] as const,
};

export function useImapConfig() {
	return useQuery({
		queryKey: imapConfigKeys.all,
		queryFn: getImapConfig,
	});
}

export function useSaveImapConfig() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: saveImapConfig,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: imapConfigKeys.all });
			queryClient.invalidateQueries({ queryKey: emailKeys.all });
		},
	});
}

export function useEmails() {
	return useQuery({
		queryKey: emailKeys.all,
		queryFn: fetchEmails,
	});
}
