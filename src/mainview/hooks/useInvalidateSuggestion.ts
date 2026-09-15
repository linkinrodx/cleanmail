import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { groupKeys } from "@/lib/query-keys";
import { invalidateSuggestion } from "@/lib/rpc";
import type { GroupScanStatus, SenderGroup } from "../../shared/rpc-types";

type SuggestionData = {
	groups: SenderGroup[];
	status: GroupScanStatus;
	cachedAt: string | null;
};

/**
 * Remove a single sender from the suggestions list immediately: drops it from
 * the in-memory query cache and from the persisted disk cache (via RPC), so a
 * cleared sender does not reappear on the next load before a real re-scan.
 */
export function useInvalidateSuggestion(
	accountId: string,
	mailboxPath: string,
) {
	const queryClient = useQueryClient();

	return useCallback(
		(authorEmail: string) => {
			const target = authorEmail.toLowerCase();
			queryClient.setQueryData<SuggestionData | undefined>(
				groupKeys.byAccountAndMailbox(accountId, mailboxPath).queryKey,
				(prev) =>
					prev
						? {
								...prev,
								groups: (prev.groups ?? []).filter(
									(g) => g.authorEmail.toLowerCase() !== target,
								),
							}
						: prev,
			);
			void invalidateSuggestion({ accountId, mailboxPath, authorEmail });
		},
		[accountId, mailboxPath, queryClient],
	);
}
