import { createQueryKeys } from "@lukemorales/query-key-factory";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PersistedAction } from "../../../shared/rpc-types";
import {
	addAction,
	applyDeleteAction,
	applyMoveAction,
	getActions,
	removeAction,
} from "../rpc";

export const actions = createQueryKeys("actions", {
	all: null,
});

export function useActions() {
	return useQuery({
		...actions.all,
		queryFn: async () => {
			const result = await getActions();
			// Sort descending by createdAt so the most recent action appears first
			const sorted = [...result.actions].sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);
			return sorted;
		},
	});
}

export function useAddAction() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (action: PersistedAction) => addAction(action),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: actions._def });
		},
	});
}

export function useRemoveAction() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (createdAt: string) => removeAction(createdAt),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: actions._def });
		},
	});
}

/** Enqueues a batch move-all job. Returns immediately after the job is queued. */
export function useApplyMoveAction() {
	return useMutation({
		mutationFn: (params: {
			jobId: string;
			authorEmail: string;
			fromMailboxPath: string;
			toMailboxPath: string;
		}) => applyMoveAction(params),
	});
}

/** Enqueues a batch delete-all job. Returns immediately after the job is queued. */
export function useApplyDeleteAction() {
	return useMutation({
		mutationFn: (params: {
			jobId: string;
			authorEmail: string;
			mailboxPath: string;
		}) => applyDeleteAction(params),
	});
}
