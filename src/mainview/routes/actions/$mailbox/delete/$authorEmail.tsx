import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	CheckCircle2Icon,
	Loader2Icon,
	PlayIcon,
	RefreshCwIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { EmailTable } from "@/components/EmailTable";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useApplyDeleteAction, useRemoveAction } from "@/lib/queries/actions";
import { useEmails } from "@/lib/queries/imap";
import { useActionsContext, useApplyActionContext } from "@/routes/__root";

export const Route = createFileRoute("/actions/$mailbox/delete/$authorEmail")({
	component: DeleteActionPage,
});

function DeleteActionPage() {
	const { mailbox, authorEmail } = Route.useParams();
	const navigate = useNavigate();

	const mailboxPath = decodeURIComponent(mailbox);
	const decodedAuthorEmail = decodeURIComponent(authorEmail);

	const mailboxLabel =
		mailboxPath === "INBOX"
			? "Inbox"
			: (mailboxPath.split(/[./\\]/).pop() ?? mailboxPath);

	const { data, isLoading, isError, error, refetch } = useEmails(mailboxPath, {
		from: authorEmail,
	});

	const fetchError = data?.error ?? (isError ? String(error) : null);
	const emails = data?.emails || [];

	// Look up the jobId (createdAt) for this action
	const { getCreatedAt } = useActionsContext();
	const jobId = getCreatedAt({
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
					onSuccess: () => {
						navigate({ to: "/" });
					},
				});
			}, 1500);
			return () => clearTimeout(timer);
		}
	}, [isSuccess, jobId, removeAction, navigate]);

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
			<header className="flex items-center justify-between border-b px-2 py-2">
				<div className="flex items-center gap-2">
					<SidebarTrigger />
					<div>
						<h1 className="text-sm font-semibold tracking-tight">
							Delete email of {mailboxLabel}
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
							disabled={
								isApplying || isSuccess || emails.length === 0 || isLoading
							}
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
					<EmailTable emails={emails} />
				)}

				{/* Loading overlay while the batch job runs */}
				{isApplying && (
					<div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
						<Loader2Icon className="size-8 animate-spin text-primary" />
						<p className="text-sm font-medium">Deleting all emails…</p>
						<p className="text-xs text-muted-foreground">
							This is running in the background
						</p>
					</div>
				)}

				{/* Success overlay */}
				{isSuccess && (
					<div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
						<CheckCircle2Icon className="size-8 text-green-500" />
						<p className="text-sm font-medium">All emails deleted!</p>
					</div>
				)}
			</main>
		</div>
	);
}
