import { useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeftIcon,
	ArchiveIcon,
	RefreshCwIcon,
	TrashIcon,
} from "lucide-react";
import { useEffect } from "react";
import { ActionOverlayPending } from "@/components/ActionOverlayPending";
import { ActionOverlaySuccess } from "@/components/ActionOverlaySuccess";
import { EmailsPagination } from "@/components/EmailsPagination";
import { EmailTable } from "@/components/EmailTable";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useApplyActionContext } from "@/contexts/ApplyActionContext";
import { useApplyMoveAction } from "@/hooks/mutations/useApplyMoveAction";
import { EMAILS_PER_PAGE } from "@/hooks/queries/useEmails";
import {
	prefetchSenderEmails,
	useSenderEmails,
} from "@/hooks/queries/useSenderEmails";
import { useMailboxes } from "@/hooks/queries/useMailboxes";
import { useQueuedAction } from "@/hooks/useQueuedAction";
import { registerSuggestionJob } from "@/lib/suggestion-jobs";

type GroupDetailPageProps = {
	accountId: string;
	mailboxPath: string;
	authorEmail: string;
	decodedAuthorEmail: string;
	page: number;
	onPageChange: (page: number) => void;
	onBack: () => void;
};

export function GroupDetailPage({
	accountId,
	mailboxPath,
	authorEmail,
	decodedAuthorEmail,
	page,
	onPageChange,
	onBack,
}: GroupDetailPageProps) {
	const queryClient = useQueryClient();

	const mailboxLabel =
		mailboxPath === "INBOX"
			? "Inbox"
			: (mailboxPath.split(/[./\\]/).pop() ?? mailboxPath);

	const { data, isLoading, isError, error, refetch } = useSenderEmails(
		accountId,
		mailboxPath,
		authorEmail,
		{ page },
	);

	const fetchError = data?.error ?? (isError ? String(error) : null);
	const emails = data?.emails || [];
	const total = data?.total ?? 0;

	// Prefetch adjacent pages once we know the total so navigation feels instant
	useEffect(() => {
		if (!total) {
			return;
		}

		const totalPages = Math.ceil(total / EMAILS_PER_PAGE);

		if (page > 1) {
			prefetchSenderEmails(queryClient, accountId, mailboxPath, authorEmail, {
				page: page - 1,
			});
		}
		if (page < totalPages) {
			prefetchSenderEmails(queryClient, accountId, mailboxPath, authorEmail, {
				page: page + 1,
			});
		}
	}, [queryClient, accountId, mailboxPath, authorEmail, page, total]);

	// Mailbox paths for archive / trash
	const { data: mailboxesData } = useMailboxes(accountId);
	const mailboxes = mailboxesData?.mailboxes ?? [];
	const archivePath = mailboxes.find((m) => m.specialUse === "\\Archive")?.path;
	const trashPath = mailboxes.find((m) => m.specialUse === "\\Trash")?.path;

	const moveMut = useApplyMoveAction(accountId);
	const { jobs } = useApplyActionContext();
	const { start, isApplying, isSuccess, jobId } = useQueuedAction({
		successDelay: 1200,
		onSuccess: onBack,
	});

	function handleArchive() {
		if (isApplying || !archivePath) return;
		start((vars) => {
			registerSuggestionJob(vars.jobId, {
				accountId,
				mailboxPath,
				authorEmail: decodedAuthorEmail,
			});
			moveMut.mutate({
				...vars,
				accountId,
				authorEmail: decodedAuthorEmail,
				fromMailboxPath: mailboxPath,
				toMailboxPath: archivePath,
			});
		});
	}

	function handleTrash() {
		if (isApplying || !trashPath) return;
		start((vars) => {
			registerSuggestionJob(vars.jobId, {
				accountId,
				mailboxPath,
				authorEmail: decodedAuthorEmail,
			});
			moveMut.mutate({
				...vars,
				accountId,
				authorEmail: decodedAuthorEmail,
				fromMailboxPath: mailboxPath,
				toMailboxPath: trashPath,
			});
		});
	}

	return (
		<div className="flex h-svh w-full min-w-0 flex-col overflow-hidden bg-background">
			{/* Top bar */}
			<header className="flex shrink-0 items-center justify-between border-b px-3 py-2.5">
				<div className="flex items-center gap-3 min-w-0">
					<SidebarTrigger className="shrink-0" />
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onBack}
						className="shrink-0"
						title="Back"
					>
						<ArrowLeftIcon data-icon="inline" className="size-4" />
						<span className="sr-only">Back</span>
					</Button>
					<div className="flex items-center gap-2.5 min-w-0">
						<span className="shrink-0 rounded-md bg-violet-50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-violet-700 dark:bg-violet-950 dark:text-violet-300">
							Suggestion
						</span>
						<div className="min-w-0">
							<h1 className="truncate text-sm font-semibold tracking-tight">
								{mailboxLabel}
							</h1>
							<p className="truncate text-xs text-muted-foreground">
								{decodedAuthorEmail}
							</p>
						</div>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-1.5 pl-3">
					<Button
						variant="ghost"
						size="sm"
						onClick={handleArchive}
						disabled={!archivePath || isApplying}
						className="gap-1.5"
						title={!archivePath ? "Archive mailbox not found" : undefined}
					>
						<ArchiveIcon data-icon="inline" className="size-3.5" />
						Archive
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={handleTrash}
						disabled={!trashPath || isApplying}
						className="gap-1.5"
						title={!trashPath ? "Trash mailbox not found" : undefined}
					>
						<TrashIcon data-icon="inline" className="size-3.5" />
						Trash
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => refetch()}
						disabled={isLoading || isApplying}
						title="Refresh"
					>
						<RefreshCwIcon
							data-icon="inline"
							className={isLoading ? "animate-spin" : undefined}
						/>
						<span className="sr-only">Refresh</span>
					</Button>
				</div>
			</header>

			{/* Main content */}
			<main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
				{fetchError ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
						<p className="text-sm text-destructive">{fetchError}</p>
						<Button variant="outline" onClick={() => refetch()}>
							Try again
						</Button>
					</div>
				) : isLoading ? (
					<div className="flex flex-1 items-center justify-center p-8">
						<p className="text-sm text-muted-foreground">Loading…</p>
					</div>
				) : emails.length === 0 ? (
					<div className="flex flex-1 items-center justify-center p-8">
						<p className="text-sm text-muted-foreground">No emails found.</p>
					</div>
				) : (
					<>
						<div className="flex items-center justify-between border-b bg-muted/30 px-4 py-1.5">
							<p className="text-xs font-medium tabular-nums text-muted-foreground">
								{total.toLocaleString()} email{total !== 1 ? "s" : ""}
							</p>
							<EmailsPagination
								page={page}
								total={total}
								onPageChange={onPageChange}
							/>
						</div>
						<EmailTable
							emails={emails}
							accountId={accountId}
							mailboxPath={mailboxPath}
						/>
					</>
				)}
				{isApplying ? (
					<ActionOverlayPending
						text={
							jobId && jobs[jobId]?.progress
								? `Moving ${jobs[jobId]?.progress?.done?.toLocaleString() ?? "0"}/${jobs[jobId]?.progress?.total?.toLocaleString() ?? "0"}…`
								: "Applying to all emails from this sender…"
						}
					/>
				) : null}
				{isSuccess ? <ActionOverlaySuccess text="Done!" /> : null}
			</main>
		</div>
	);
}
