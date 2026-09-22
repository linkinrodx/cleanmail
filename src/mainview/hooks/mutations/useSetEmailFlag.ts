import { useMutation, useQueryClient } from "@tanstack/react-query";
import { emailKeys, mutationKeys } from "@/lib/query-keys";
import { setEmailFlag } from "@/lib/rpc";

export function useSetEmailFlag(accountId: string, mailboxPath: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: mutationKeys.setEmailFlag(accountId, mailboxPath),
		mutationFn: async ({ uid, flagged }: { uid: number; flagged: boolean }) => {
			const res = await setEmailFlag({ accountId, mailboxPath, uid, flagged });
			if (!res.success) {
				throw new Error(res.error ?? "Failed to set email flag");
			}
			return res;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: emailKeys.byAccountAndMailbox(accountId, mailboxPath)
					.queryKey,
			});
		},
	});
}
