import { createQueryKeys } from "@lukemorales/query-key-factory";
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

export const imapConfig = createQueryKeys("imap-config", {
	all: null,
});

export const emails = createQueryKeys("emails", {
	byMailbox: (path: string) => ({
		queryKey: [path],
		contextQueries: {
			filtered: (filters: {
				page?: number;
				itemsPerPage?: number;
				from?: string;
			}) => ({
				queryKey: [filters],
			}),
			detail: (uid: number) => ({
				queryKey: [uid],
			}),
		},
	}),
});

export const mailboxes = createQueryKeys("mailboxes", {
	all: null,
});

export function useImapConfig() {
	return useQuery({
		...imapConfig.all,
		queryFn: getImapConfig,
	});
}

export function useSaveImapConfig() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: saveImapConfig,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: imapConfig._def });
			queryClient.invalidateQueries({ queryKey: emails._def });
			queryClient.invalidateQueries({ queryKey: mailboxes._def });
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
		...emails.byMailbox(mailboxPath)._ctx.filtered(resolvedFilters),
		queryFn: () => fetchEmails({ mailboxPath, ...resolvedFilters }),
	});
}

export function useMailboxes() {
	return useQuery({
		...mailboxes.all,
		queryFn: fetchMailboxes,
	});
}

export function useCreateMailbox() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (name: string) => createMailbox(name),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: mailboxes._def });
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
				queryKey: emails.byMailbox(mailboxPath).queryKey,
			});
			if (
				trashMailboxPath &&
				trashMailboxPath.toLowerCase() !== mailboxPath.toLowerCase()
			) {
				queryClient.invalidateQueries({
					queryKey: emails.byMailbox(trashMailboxPath).queryKey,
				});
			}
			queryClient.invalidateQueries({ queryKey: mailboxes._def });
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
				queryKey: emails.byMailbox(fromMailboxPath).queryKey,
			});
			queryClient.invalidateQueries({
				queryKey: emails.byMailbox(toMailboxPath).queryKey,
			});
			queryClient.invalidateQueries({ queryKey: mailboxes._def });
		},
	});
}

export function useEmailDetail(
	mailboxPath: string,
	uid: number | null,
	enabled = true,
) {
	return useQuery({
		...emails.byMailbox(mailboxPath)._ctx.detail(uid ?? 0),
		queryFn: () => fetchEmailDetail({ mailboxPath, uid: uid! }),
		enabled: enabled && uid !== null,
	});
}
