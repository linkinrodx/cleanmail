import { useMutation } from "@tanstack/react-query";
import { mutationKeys } from "@/lib/query-keys";
import { applyDeleteAction } from "@/lib/rpc";

/** Enqueues a batch delete-all job. Returns immediately after the job is queued. */
export function useApplyDeleteAction(accountId: string) {
	return useMutation({
		mutationKey: mutationKeys.applyDeleteAction(accountId),
		mutationFn: async (params: {
			jobId: string;
			accountId: string;
			authorEmail: string;
			mailboxPath: string;
		}) => {
			const res = await applyDeleteAction(params);
			if (!res.queued) {
				throw new Error(res.error ?? "Job could not be queued");
			}
			return res;
		},
	});
}
