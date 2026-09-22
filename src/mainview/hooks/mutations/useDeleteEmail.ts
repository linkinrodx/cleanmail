import {
	type QueryKey,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { emailKeys, mailboxKeys, mutationKeys } from "@/lib/query-keys";
import { deleteEmail } from "@/lib/rpc";
import type { Email } from "../../../shared/rpc-types";

type CachedEmailList = { emails: Email[]; total: number; error?: string };

type DeleteRollbackContext = {
	previous: Array<[QueryKey, CachedEmailList | undefined]>;
};

export function useDeleteEmail(
	accountId: string,
	mailboxPath: string,
	trashMailboxPath?: string,
) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: mutationKeys.deleteEmail(accountId, mailboxPath),
		mutationFn: (uid: number) =>
			deleteEmail({ accountId, mailboxPath, uid, trashMailboxPath }),
		onMutate: async (uid): Promise<DeleteRollbackContext> => {
			const prefix = emailKeys.byAccountAndMailbox(
				accountId,
				mailboxPath,
			).queryKey;

			await queryClient.cancelQueries({ queryKey: prefix });

			const previous: DeleteRollbackContext["previous"] =
				queryClient.getQueriesData<CachedEmailList | undefined>({
					queryKey: prefix,
				});

			for (const [key, data] of previous) {
				if (data && Array.isArray(data.emails)) {
					queryClient.setQueryData<CachedEmailList | undefined>(key, {
						...data,
						emails: data.emails.filter((e) => e.uid !== uid),
						total: Math.max(0, data.total - 1),
					});
				}
			}

			return { previous };
		},
		onError: (_err, _uid, context) => {
			if (context?.previous) {
				for (const [key, data] of context.previous) {
					queryClient.setQueryData(key, data);
				}
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: emailKeys.byAccountAndMailbox(accountId, mailboxPath)
					.queryKey,
			});

			if (
				trashMailboxPath &&
				trashMailboxPath.toLowerCase() !== mailboxPath.toLowerCase()
			) {
				queryClient.invalidateQueries({
					queryKey: emailKeys.byAccountAndMailbox(accountId, trashMailboxPath)
						.queryKey,
				});
			}

			queryClient.invalidateQueries({
				queryKey: mailboxKeys.byAccount(accountId).queryKey,
			});
		},
	});
}
