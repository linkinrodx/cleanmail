export type SuggestionJobInfo = {
	accountId: string;
	mailboxPath: string;
	authorEmail: string;
};

const registry = new Map<string, SuggestionJobInfo>();

/** Remember the context of a queued suggestion bulk action by its job id. */
export function registerSuggestionJob(
	jobId: string,
	info: SuggestionJobInfo,
): void {
	registry.set(jobId, info);
}

/** Pop a suggestion job's context (used by the global completion watcher). */
export function takeSuggestionJob(
	jobId: string,
): SuggestionJobInfo | undefined {
	const info = registry.get(jobId);
	if (info) registry.delete(jobId);
	return info;
}
