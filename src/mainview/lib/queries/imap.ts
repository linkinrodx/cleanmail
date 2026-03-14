import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createMailbox,
	deleteEmail,
	fetchEmailDetail,
	fetchEmails,
	fetchMailboxes,
	getImapConfig,
	moveEmail,
	saveImapConfig,
} from "../rpc";

export const imapConfigKeys = {
	all: ["imap-config"] as const,
};

export const emailKeys = {
	all: ["emails"] as const,
	byMailbox: (path: string) => ["emails", path] as const,
	byMailboxFiltered: (
		path: string,
		filters: { page?: number; itemsPerPage?: number; from?: string },
	) => ["emails", path, filters] as const,
	detail: (mailboxPath: string, uid: number) =>
		["emails", mailboxPath, "detail", uid] as const,
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

export const EMAILS_PER_PAGE = 20;

export function useEmails(
	mailboxPath: string,
	filters: { page?: number; itemsPerPage?: number; from?: string } = {},
) {
	const { page = 1, itemsPerPage = EMAILS_PER_PAGE, from } = filters;
	const resolvedFilters = { page, itemsPerPage, from };
	return useQuery({
		queryKey: emailKeys.byMailboxFiltered(mailboxPath, resolvedFilters),
		queryFn: () => fetchEmails({ mailboxPath, ...resolvedFilters }),
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

export function useDeleteEmail(mailboxPath: string, trashMailboxPath?: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (uid: number) =>
			deleteEmail(mailboxPath, uid, trashMailboxPath),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: emailKeys.byMailbox(mailboxPath),
			});
			if (
				trashMailboxPath &&
				trashMailboxPath.toLowerCase() !== mailboxPath.toLowerCase()
			) {
				queryClient.invalidateQueries({
					queryKey: emailKeys.byMailbox(trashMailboxPath),
				});
			}
			queryClient.invalidateQueries({ queryKey: mailboxKeys.all });
		},
	});
}

export function useMoveEmail(fromMailboxPath: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			uid,
			toMailboxPath,
		}: {
			uid: number;
			toMailboxPath: string;
		}) => moveEmail(fromMailboxPath, toMailboxPath, uid),
		onSuccess: (_data, { toMailboxPath }) => {
			queryClient.invalidateQueries({
				queryKey: emailKeys.byMailbox(fromMailboxPath),
			});
			queryClient.invalidateQueries({
				queryKey: emailKeys.byMailbox(toMailboxPath),
			});
			queryClient.invalidateQueries({ queryKey: mailboxKeys.all });
		},
	});
}

export function useEmailDetail(
	mailboxPath: string,
	uid: number | null,
	enabled = true,
) {
	return useQuery({
		queryKey: emailKeys.detail(mailboxPath, uid ?? 0),
		queryFn: () => fetchEmailDetail({ mailboxPath, uid: uid! }),
		enabled: enabled && uid !== null,
	});
}
