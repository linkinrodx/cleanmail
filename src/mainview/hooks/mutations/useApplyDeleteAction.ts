import { useMutation } from "@tanstack/react-query";
import { mutationKeys } from "@/lib/query-keys";
import { applyDeleteAction } from "@/lib/rpc";

/** Enqueues a batch delete-all job. Returns immediately after the job is queued. */
export function useApplyDeleteAction(accountId: string) {
	return useMutation({
		mutationKey: mutationKeys.applyDeleteAction(accountId),
		mutationFn: (params: {
			jobId: string;
			accountId: string;
			authorEmail: string;
			mailboxPath: string;
		}) => applyDeleteAction(params),
	});
}
