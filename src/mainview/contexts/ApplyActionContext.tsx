import { createContext, useContext, useEffect, useState } from "react";
import { addActionStatusListener, removeActionStatusListener } from "@/lib/rpc";
import type { ActionJobStatus } from "../../shared/rpc-types";

export type ApplyJobState = {
	status: ActionJobStatus;
	error?: string;
};

type ApplyActionContextValue = {
	jobs: Record<string, ApplyJobState>;
	setJobStatus: (jobId: string, state: ApplyJobState) => void;
};

export const ApplyActionContext = createContext<ApplyActionContextValue>({
	jobs: {},
	setJobStatus: () => {},
});

export function useApplyActionContext() {
	return useContext(ApplyActionContext);
}

export function ApplyActionContextProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [applyJobs, setApplyJobs] = useState<Record<string, ApplyJobState>>({});

	// Subscribe to status updates pushed from the bun process
	useEffect(() => {
		function onUpdate({
			jobId,
			status,
			error,
		}: {
			jobId: string;
			status: ActionJobStatus;
			error?: string;
		}) {
			setApplyJobs((prev) => ({ ...prev, [jobId]: { status, error } }));
		}

		addActionStatusListener(onUpdate);
		return () => removeActionStatusListener(onUpdate);
	}, []);

	const value: ApplyActionContextValue = {
		jobs: applyJobs,
		setJobStatus: (jobId, state) => {
			setApplyJobs((prev) => ({ ...prev, [jobId]: state }));
		},
	};

	return <ApplyActionContext value={value}>{children}</ApplyActionContext>;
}
