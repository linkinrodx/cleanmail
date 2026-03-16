import { useMutation } from "@tanstack/react-query";
import { mutationKeys } from "@/lib/query-keys";
import { applyMoveAction } from "@/lib/rpc";

/** Enqueues a batch move-all job. Returns immediately after the job is queued. */
export function useApplyMoveAction() {
	return useMutation({
		mutationKey: mutationKeys.applyMoveAction(),
		mutationFn: (params: {
			jobId: string;
			authorEmail: string;
			fromMailboxPath: string;
			toMailboxPath: string;
		}) => applyMoveAction(params),
	});
}
