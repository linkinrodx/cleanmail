import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { EmailsPagination } from "@/components/EmailsPagination";
import { EmailTable } from "@/components/EmailTable";
import {
	ImapSetupDialog,
	ImapSetupTrigger,
} from "@/components/ImapSetupDialog";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useEmails, useImapConfig } from "@/lib/queries/imap";

export const Route = createFileRoute("/")({
	validateSearch: (search: Record<string, unknown>) => ({
		page: Number(search.page) || 1,
	}),
	component: IndexPage,
});

function IndexPage() {
	const activeMailboxPath = "INBOX";
	const { page } = Route.useSearch();
	const navigate = useNavigate({ from: "/" });

	const [setupOpen, setSetupOpen] = useState(false);

	const { data: imapConfig, isLoading: configLoading } = useImapConfig();
	const {
		data: emailsData,
		isLoading: emailsLoading,
		isError,
		error,
		refetch,
	} = useEmails(activeMailboxPath, { page });

	const emails = emailsData?.emails ?? [];
	const total = emailsData?.total ?? 0;
	const fetchError = emailsData?.error ?? (isError ? String(error) : null);

	const isLoading = configLoading || emailsLoading;
	const isConfigured = !!imapConfig;

	return (
		<div className="flex min-h-screen flex-col bg-background">
			{/* Top bar */}
			<header className="flex items-center justify-between border-b px-2 py-2">
				<div className="flex items-center gap-2">
					<SidebarTrigger />
					<h1 className="text-sm font-semibold tracking-tight">Inbox</h1>
				</div>
				<div className="flex items-center gap-1">
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
					<ImapSetupTrigger onOpenChange={setSetupOpen} />
				</div>
			</header>

			{/* Main content */}
			<main className="flex flex-1 flex-col">
				{!isConfigured && !configLoading ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
						<p className="text-sm text-muted-foreground">
							No IMAP account configured yet.
						</p>
						<Button onClick={() => setSetupOpen(true)}>
							Set up IMAP Account
						</Button>
					</div>
				) : fetchError ? (
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
						<EmailsPagination
							page={page}
							total={total}
							onPageChange={(p) => navigate({ search: { page: p } })}
						/>
						<EmailTable emails={emails} mailboxPath={activeMailboxPath} />
					</>
				)}
			</main>

			<ImapSetupDialog open={setupOpen} onOpenChange={setSetupOpen} />
		</div>
	);
}
