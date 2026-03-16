import { useMutation } from "@tanstack/react-query";
import { mutationKeys } from "@/lib/query-keys";
import { applyDeleteAction } from "@/lib/rpc";

/** Enqueues a batch delete-all job. Returns immediately after the job is queued. */
export function useApplyDeleteAction() {
	return useMutation({
		mutationKey: mutationKeys.applyDeleteAction(),
		mutationFn: (params: {
			jobId: string;
			authorEmail: string;
			mailboxPath: string;
		}) => applyDeleteAction(params),
	});
}
