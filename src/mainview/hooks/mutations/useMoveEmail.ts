import {
	type QueryKey,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { emailKeys, mailboxKeys, mutationKeys } from "@/lib/query-keys";
import { moveEmail } from "@/lib/rpc";
import type { Email } from "../../../shared/rpc-types";

type CachedEmailList = { emails: Email[]; total: number; error?: string };

type MoveRollbackContext = {
	previous: Array<[QueryKey, CachedEmailList | undefined]>;
};

type MoveVariables = {
	uid: number;
	toMailboxPath: string;
};

export function useMoveEmail(accountId: string, fromMailboxPath: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: mutationKeys.moveEmail(accountId, fromMailboxPath),
		mutationFn: ({ uid, toMailboxPath }: MoveVariables) =>
			moveEmail({ accountId, fromMailboxPath, toMailboxPath, uid }),
		onMutate: async ({ uid }): Promise<MoveRollbackContext> => {
			const prefix = emailKeys.byAccountAndMailbox(
				accountId,
				fromMailboxPath,
			).queryKey;

			await queryClient.cancelQueries({ queryKey: prefix });

			const previous: MoveRollbackContext["previous"] =
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
		onError: (_err, _variables, context) => {
			if (context?.previous) {
				for (const [key, data] of context.previous) {
					queryClient.setQueryData(key, data);
				}
			}
		},
		onSettled: (_data, _error, { toMailboxPath }) => {
			queryClient.invalidateQueries({
				queryKey: emailKeys.byAccountAndMailbox(accountId, fromMailboxPath)
					.queryKey,
			});
			queryClient.invalidateQueries({
				queryKey: emailKeys.byAccountAndMailbox(accountId, toMailboxPath)
					.queryKey,
			});
			queryClient.invalidateQueries({
				queryKey: mailboxKeys.byAccount(accountId).queryKey,
			});
		},
	});
}
