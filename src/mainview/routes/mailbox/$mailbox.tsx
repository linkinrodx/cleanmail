import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";
import { EmailsPagination } from "@/components/EmailsPagination";
import { EmailTable } from "@/components/EmailTable";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useEmails } from "@/lib/queries/imap";

export const Route = createFileRoute("/mailbox/$mailbox")({
	validateSearch: (search: Record<string, unknown>) => ({
		page: Number(search.page) || 1,
	}),
	component: MailboxPage,
});

function MailboxPage() {
	const { mailbox: encodedMailbox } = Route.useParams();
	const { page } = Route.useSearch();
	const navigate = useNavigate({ from: "/mailbox/$mailbox" });
	const mailboxPath = decodeURIComponent(encodedMailbox);

	const {
		data: emailsData,
		isLoading: emailsLoading,
		isError,
		error,
		refetch,
	} = useEmails(mailboxPath, { page });

	const emails = emailsData?.emails ?? [];
	const total = emailsData?.total ?? 0;
	const fetchError = emailsData?.error ?? (isError ? String(error) : null);

	const mailboxDisplayName =
		mailboxPath === "INBOX"
			? "Inbox"
			: (mailboxPath.split(/[./\\]/).pop() ?? mailboxPath);

	return (
		<div className="flex min-h-screen flex-col bg-background">
			{/* Top bar */}
			<header className="flex items-center justify-between border-b px-2 py-2">
				<div className="flex items-center gap-2">
					<SidebarTrigger />
					<h1 className="text-sm font-semibold tracking-tight">
						{mailboxDisplayName}
					</h1>
				</div>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => refetch()}
						disabled={emailsLoading}
						title="Refresh"
					>
						<RefreshCwIcon
							data-icon="inline"
							className={emailsLoading ? "animate-spin" : undefined}
						/>
						<span className="sr-only">Refresh</span>
					</Button>
				</div>
			</header>

			{/* Main content */}
			<main className="flex flex-1 flex-col">
				{fetchError ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
						<p className="text-sm text-destructive">{fetchError}</p>
						<Button variant="outline" onClick={() => refetch()}>
							Try again
						</Button>
					</div>
				) : emailsLoading ? (
					<div className="flex flex-1 items-center justify-center p-8">
						<p className="text-sm text-muted-foreground">Loading…</p>
					</div>
				) : emails.length === 0 ? (
					<div className="flex flex-1 items-center justify-center p-8">
						<p className="text-sm text-muted-foreground">No emails found.</p>
					</div>
				) : (
					<>
						<EmailsPagination
							page={page}
							total={total}
							onPageChange={(p) => navigate({ search: { page: p } })}
						/>
						<EmailTable emails={emails} mailboxPath={mailboxPath} />
					</>
				)}
			</main>
		</div>
	);
}
