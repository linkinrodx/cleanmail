import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	addActionStatusListener,
	invalidateSuggestion,
	removeActionStatusListener,
} from "@/lib/rpc";
import { groupKeys } from "@/lib/query-keys";
import { takeSuggestionJob } from "@/lib/suggestion-jobs";
import type {
	ActionStatusUpdate,
	GroupScanStatus,
	SenderGroup,
} from "../../shared/rpc-types";

type SuggestionData = {
	groups: SenderGroup[];
	status: GroupScanStatus;
	cachedAt: string | null;
};

/**
 * Global watcher for suggestion bulk actions (archive / trash / delete). The
 * work runs in the bun background job queue, so it can finish after the user
 * has navigated away from the screen that started it. This lives above the
 * router so the completion toast and the removal of the cleared sender from the
 * suggestions list happen reliably, on any screen.
 */
export function SuggestionJobWatcher() {
	const queryClient = useQueryClient();

	useEffect(() => {
		function onUpdate({ jobId, status, error }: ActionStatusUpdate) {
			if (status !== "success" && status !== "error") return;
			const info = takeSuggestionJob(jobId);
			if (!info) return;

			if (status === "success") {
				toast.success(`Done — emails from ${info.authorEmail} processed`);
				queryClient.setQueryData<SuggestionData | undefined>(
					groupKeys.byAccountAndMailbox(info.accountId, info.mailboxPath)
						.queryKey,
					(prev) =>
						prev
							? {
									...prev,
									groups: (prev.groups ?? []).filter(
										(g) =>
											g.authorEmail.toLowerCase() !==
											info.authorEmail.toLowerCase(),
									),
								}
							: prev,
				);
				void invalidateSuggestion({
					accountId: info.accountId,
					mailboxPath: info.mailboxPath,
					authorEmail: info.authorEmail,
				});
			} else {
				toast.error(
					error ?? `Failed to process emails from ${info.authorEmail}`,
				);
			}
		}

		addActionStatusListener(onUpdate);
		return () => removeActionStatusListener(onUpdate);
	}, [queryClient]);

	return null;
}
