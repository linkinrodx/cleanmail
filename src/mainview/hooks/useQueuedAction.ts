import { useCallback, useEffect, useRef, useState } from "react";
import { useApplyActionContext } from "@/contexts/ApplyActionContext";

type QueuedActionOptions = {
	onSuccess?: () => void;
	onError?: (error: string) => void;
	/** Time in ms the success state is shown before calling onSuccess. Default 0. */
	successDelay?: number;
};

export function useQueuedAction(options: QueuedActionOptions = {}) {
	const { jobs, setJobStatus } = useApplyActionContext();
	const [jobId, setJobId] = useState<string | null>(null);
	const handledRef = useRef(false);

	const jobState = jobId ? jobs[jobId] : undefined;
	const isApplying =
		jobState?.status === "pending" || jobState?.status === "running";
	const isSuccess = jobState?.status === "success";
	const isError = jobState?.status === "error";

	const start = useCallback(
		(mutate: (vars: { jobId: string }) => void) => {
			const id = crypto.randomUUID();
			handledRef.current = false;
			setJobId(id);
			setJobStatus(id, { status: "pending" });
			mutate({ jobId: id });
		},
		[setJobStatus],
	);

	useEffect(() => {
		if (!jobId) return;
		if (isError && !handledRef.current) {
			handledRef.current = true;
			options.onError?.(jobState?.error ?? "Action failed");
			setJobId(null);
		}
	}, [isError, jobState?.error, jobId, options]);

	useEffect(() => {
		if (!isSuccess || handledRef.current) return;
		handledRef.current = true;
		const delay = options.successDelay ?? 0;
		if (delay > 0) {
			const t = setTimeout(() => {
				options.onSuccess?.();
				setJobId(null);
			}, delay);
			return () => clearTimeout(t);
		}
		options.onSuccess?.();
		setJobId(null);
	}, [isSuccess, options]);

	return { jobId, start, isApplying, isSuccess, isError };
}
