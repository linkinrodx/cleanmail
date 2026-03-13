import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createMailbox,
	fetchEmails,
	fetchMailboxes,
	getImapConfig,
	saveImapConfig,
} from "../rpc";

export const imapConfigKeys = {
	all: ["imap-config"] as const,
};

export const emailKeys = {
	all: ["emails"] as const,
	byMailbox: (path: string) => ["emails", path] as const,
};

export const mailboxKeys = {
	all: ["mailboxes"] as const,
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
			queryClient.invalidateQueries({ queryKey: mailboxKeys.all });
		},
	});
}

export function useEmails(mailboxPath: string) {
	return useQuery({
		queryKey: emailKeys.byMailbox(mailboxPath),
		queryFn: () => fetchEmails(mailboxPath),
	});
}

export function useMailboxes() {
	return useQuery({
		queryKey: mailboxKeys.all,
		queryFn: fetchMailboxes,
	});
}

export function useCreateMailbox() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (name: string) => createMailbox(name),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: mailboxKeys.all });
		},
	});
}
