import { useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2Icon,
	Loader2Icon,
	PlayIcon,
	RefreshCwIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { EmailsPagination } from "@/components/EmailsPagination";
import { EmailTable } from "@/components/EmailTable";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useActionsContext } from "@/contexts/ActionsContext";
import { useApplyActionContext } from "@/contexts/ApplyActionContext";
import { useApplyDeleteAction } from "@/hooks/mutations/useApplyDeleteAction";
import { useRemoveAction } from "@/hooks/mutations/useRemoveAction";
import {
	EMAILS_PER_PAGE,
	prefetchEmails,
	useEmails,
} from "@/hooks/queries/useEmails";

type DeleteActionPageProps = {
	mailboxPath: string;
	authorEmail: string;
	decodedAuthorEmail: string;
	page: number;
	onPageChange: (page: number) => void;
	onSuccess: () => void;
};

export function DeleteActionPage({
	mailboxPath,
	authorEmail,
	decodedAuthorEmail,
	page,
	onPageChange,
	onSuccess,
}: DeleteActionPageProps) {
	const queryClient = useQueryClient();

	const mailboxLabel =
		mailboxPath === "INBOX"
			? "Inbox"
			: (mailboxPath.split(/[./\\]/).pop() ?? mailboxPath);

	const { data, isLoading, isError, error, refetch } = useEmails(mailboxPath, {
		from: authorEmail,
		page,
	});

	const fetchError = data?.error ?? (isError ? String(error) : null);
	const emails = data?.emails || [];
	const total = data?.total ?? 0;

	// Prefetch adjacent pages once we know the total so navigation feels instant
	useEffect(() => {
		if (!total) return;

		const totalPages = Math.ceil(total / EMAILS_PER_PAGE);

		if (page > 1) {
			prefetchEmails(queryClient, mailboxPath, {
				from: authorEmail,
				page: page - 1,
			});
		}
		if (page < totalPages) {
			prefetchEmails(queryClient, mailboxPath, {
				from: authorEmail,
				page: page + 1,
			});
		}
	}, [queryClient, mailboxPath, authorEmail, page, total]);

	// Look up the jobId for this action
	const { getId } = useActionsContext();
	const jobId = getId({
		type: "delete",
		uid: 0,
		authorEmail: decodedAuthorEmail,
		mailboxPath,
	});

	const { jobs, setJobStatus } = useApplyActionContext();
	const jobState = jobId ? jobs[jobId] : undefined;
	const isApplying =
		jobState?.status === "pending" || jobState?.status === "running";
	const isSuccess = jobState?.status === "success";

	const applyDelete = useApplyDeleteAction();
	const removeAction = useRemoveAction();

	// Auto-clear on success: remove the action and navigate away
	const successHandled = useRef(false);
	useEffect(() => {
		if (isSuccess && jobId && !successHandled.current) {
			successHandled.current = true;
			const timer = setTimeout(() => {
				removeAction.mutate(jobId, {
					onSuccess,
				});
			}, 1500);
			return () => clearTimeout(timer);
		}
	}, [isSuccess, jobId, removeAction, onSuccess]);

	function handleApplyAll() {
		if (!jobId) return;
		setJobStatus(jobId, { status: "pending" });
		applyDelete.mutate({
			jobId,
			authorEmail: decodedAuthorEmail,
			mailboxPath,
		});
	}

	return (
		<div className="flex min-h-screen flex-col bg-background">
			{/* Top bar */}
			<header className="flex items-center justify-between border-b px-3 py-2.5">
				<div className="flex items-center gap-3 min-w-0">
					<SidebarTrigger className="shrink-0" />
					<div className="flex items-center gap-2.5 min-w-0">
						<span className="shrink-0 rounded-md bg-red-50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-red-700 dark:bg-red-950 dark:text-red-300">
							Delete
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
					{jobId && (
						<Button
							variant="default"
							size="sm"
							onClick={handleApplyAll}
							disabled={isApplying || isSuccess || total === 0 || isLoading}
							className="gap-1.5"
						>
							{isApplying ? (
								<>
									<Loader2Icon className="size-3.5 animate-spin" />
									Applying…
								</>
							) : (
								<>
									<PlayIcon className="size-3.5" />
									Apply to all
								</>
							)}
						</Button>
					)}
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => refetch()}
						disabled={isLoading}
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
			<main className="relative flex flex-1 flex-col">
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
						<EmailTable emails={emails} mailboxPath={mailboxPath} />
					</>
				)}

				{/* Loading overlay while the batch job runs */}
				{isApplying && (
					<div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
						<div className="flex flex-col items-center gap-3 rounded-xl border bg-background p-8 shadow-lg">
							<Loader2Icon className="size-7 animate-spin text-primary" />
							<div className="text-center">
								<p className="text-sm font-semibold">Deleting all emails…</p>
								<p className="mt-0.5 text-xs text-muted-foreground">
									This is running in the background
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Success overlay */}
				{isSuccess && (
					<div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
						<div className="flex flex-col items-center gap-3 rounded-xl border bg-background p-8 shadow-lg">
							<CheckCircle2Icon className="size-7 text-green-500" />
							<p className="text-sm font-semibold">All emails deleted!</p>
						</div>
					</div>
				)}
			</main>
		</div>
	);
}
