import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	CheckCircle2Icon,
	Loader2Icon,
	PlayIcon,
	RefreshCwIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmailsPagination } from "@/components/EmailsPagination";
import { EmailTable } from "@/components/EmailTable";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useApplyMoveAction, useRemoveAction } from "@/lib/queries/actions";
import { useEmails } from "@/lib/queries/imap";
import { useActionsContext, useApplyActionContext } from "@/routes/__root";
import { EmailDialog } from "@/components/EmailDialog";

export const Route = createFileRoute(
	"/actions/$mailbox/move/$authorEmail/to/$toMailbox",
)({
	validateSearch: (search: Record<string, unknown>) => ({
		page: Number(search.page) || 1,
	}),
	component: MoveActionPage,
});

function MoveActionPage() {
	const { mailbox, authorEmail, toMailbox } = Route.useParams();
	const { page } = Route.useSearch();
	const navigate = useNavigate({
		from: "/actions/$mailbox/move/$authorEmail/to/$toMailbox",
	});

	const [selectedUid, setSelectedUid] = useState<number | null>(null);

	const fromMailboxPath = decodeURIComponent(mailbox);
	const toMailboxPath = decodeURIComponent(toMailbox);
	const decodedAuthorEmail = decodeURIComponent(authorEmail);

	const fromLabel =
		fromMailboxPath === "INBOX"
			? "Inbox"
			: (fromMailboxPath.split(/[./\\]/).pop() ?? fromMailboxPath);
	const toLabel =
		toMailboxPath === "INBOX"
			? "Inbox"
			: (toMailboxPath.split(/[./\\]/).pop() ?? toMailboxPath);

	const { data, isLoading, isError, error, refetch } = useEmails(
		fromMailboxPath,
		{ from: authorEmail, page },
	);

	const fetchError = data?.error ?? (isError ? String(error) : null);
	const emails = data?.emails || [];
	const total = data?.total ?? 0;

	// Look up the jobId (createdAt) for this action
	const { getCreatedAt } = useActionsContext();
	const jobId = getCreatedAt({
		type: "move",
		uid: 0,
		authorEmail: decodedAuthorEmail,
		fromMailboxPath,
		toMailboxPath,
	});

	const { jobs, setJobStatus } = useApplyActionContext();
	const jobState = jobId ? jobs[jobId] : undefined;
	const isApplying =
		jobState?.status === "pending" || jobState?.status === "running";
	const isSuccess = jobState?.status === "success";

	const applyMove = useApplyMoveAction();
	const removeAction = useRemoveAction();

	// Auto-clear on success: remove the action and navigate away
	const successHandled = useRef(false);
	useEffect(() => {
		if (isSuccess && jobId && !successHandled.current) {
			successHandled.current = true;
			// Wait a moment to let the user see the success state, then clean up
			const timer = setTimeout(() => {
				removeAction.mutate(jobId, {
					onSuccess: () => {
						navigate({ to: "/", search: { page: 1 } });
					},
				});
			}, 1500);
			return () => clearTimeout(timer);
		}
	}, [isSuccess, jobId, removeAction, navigate]);

	function handleApplyAll() {
		if (!jobId) return;
		setJobStatus(jobId, { status: "pending" });
		applyMove.mutate({
			jobId,
			authorEmail: decodedAuthorEmail,
			fromMailboxPath,
			toMailboxPath,
		});
	}

	return (
		<div className="flex min-h-screen flex-col bg-background">
			{/* Top bar */}
			<header className="flex items-center justify-between border-b px-2 py-2">
				<div className="flex items-center gap-2">
					<SidebarTrigger />
					<div>
						<h1 className="text-sm font-semibold tracking-tight">
							Move from {fromLabel} to {toLabel}
						</h1>
						<p className="text-xs text-muted-foreground">
							{decodedAuthorEmail}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-1">
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
						<div className="flex items-center justify-between border-b px-4 py-2">
							<p className="text-sm text-muted-foreground">
								{total} email{total !== 1 ? "s" : ""}
							</p>
							<EmailsPagination
								page={page}
								total={total}
								onPageChange={(p) => navigate({ search: { page: p } })}
							/>
						</div>
						<EmailTable emails={emails} onRowClick={setSelectedUid} />
					</>
				)}

				{/* Loading overlay while the batch job runs */}
				{isApplying && (
					<div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
						<Loader2Icon className="size-8 animate-spin text-primary" />
						<p className="text-sm font-medium">Moving all emails…</p>
						<p className="text-xs text-muted-foreground">
							This is running in the background
						</p>
					</div>
				)}

				{/* Success overlay */}
				{isSuccess && (
					<div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
						<CheckCircle2Icon className="size-8 text-green-500" />
						<p className="text-sm font-medium">All emails moved!</p>
					</div>
				)}
			</main>

			<EmailDialog
				open={selectedUid !== null}
				onOpenChange={(open) => {
					if (!open) setSelectedUid(null);
				}}
				mailboxPath={fromMailboxPath}
				uid={selectedUid}
			/>
		</div>
	);
}
