import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { GroupScanProgress } from "../../../shared/rpc-types";
import { groupKeys } from "@/lib/query-keys";
import {
	addGroupScanListener,
	cancelGroupScan,
	getSuggestions,
	removeGroupScanListener,
	startGroupScan as rpcStartGroupScan,
} from "@/lib/rpc";

export function useSuggestions(accountId: string, mailboxPath: string) {
	const queryClient = useQueryClient();
	const [progress, setProgress] = useState<GroupScanProgress | null>(null);
	const autoStartedRef = useRef(false);

	const queryResult = useQuery({
		...groupKeys.byAccountAndMailbox(accountId, mailboxPath),
		queryFn: () => getSuggestions({ accountId, mailboxPath }),
		staleTime: 5 * 60 * 1000,
	});

	const { data, isLoading, refetch } = queryResult;

	// Listen for background scan progress pushes for this account+mailbox.
	useEffect(() => {
		function handleProgress(p: GroupScanProgress) {
			if (p.accountId !== accountId || p.mailboxPath !== mailboxPath) return;
			setProgress(p);
			if (p.status === "ready" && p.groups) {
				queryClient.setQueryData(
					groupKeys.byAccountAndMailbox(accountId, mailboxPath).queryKey,
					{
						groups: p.groups,
						status: "ready",
						cachedAt: p.cachedAt ?? null,
					},
				);
			}
		}

		addGroupScanListener(handleProgress);
		return () => removeGroupScanListener(handleProgress);
	}, [accountId, mailboxPath, queryClient]);

	const startScan = useCallback(
		(force: boolean) => {
			// Optimistically show the scanning state so the UI reacts immediately
			// (before the first progress frame arrives).
			setProgress({
				accountId,
				mailboxPath,
				status: "scanning",
				phase: "search",
				scanned: 0,
				total: 0,
				sendersFound: 0,
			});
			return rpcStartGroupScan({ accountId, mailboxPath, force });
		},
		[accountId, mailboxPath],
	);

	const cancelScan = useCallback(() => {
		setProgress(null);
		return cancelGroupScan({ accountId, mailboxPath });
	}, [accountId, mailboxPath]);

	// Auto-start a scan once when there is no cache yet.
	useEffect(() => {
		if (autoStartedRef.current) return;
		if (
			data?.status === "idle" &&
			(data?.groups?.length ?? 0) === 0 &&
			!progress
		) {
			autoStartedRef.current = true;
			startScan(false);
		}
	}, [data?.status, data?.groups?.length, progress, startScan]);

	const scanStatus = progress?.status ?? data?.status ?? "idle";

	return {
		groups: data?.groups ?? [],
		cachedAt: data?.cachedAt ?? null,
		status: scanStatus,
		progress,
		isLoading: isLoading && !progress,
		isScanning: progress?.status === "scanning",
		error: progress?.error ?? data?.error ?? null,
		startScan,
		cancelScan,
		refetch,
	};
}
