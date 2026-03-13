import { createFileRoute } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";
import { EmailTable } from "@/components/EmailTable";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useEmails } from "@/lib/queries/imap";

export const Route = createFileRoute(
	"/actions/$mailbox/move/$authorEmail/to/$toMailbox",
)({
	component: MoveActionPage,
});

function MoveActionPage() {
	const { mailbox, authorEmail, toMailbox } = Route.useParams();

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

	const {
		data: emailsData,
		isLoading,
		isError,
		error,
		refetch,
	} = useEmails(fromMailboxPath);

	// Filter to only show emails from the specific author
	const allEmails = emailsData?.emails ?? [];
	const emails = allEmails.filter((email) => {
		const addrMatch = email.from.match(/<([^>]+)>/);
		const addr = addrMatch ? addrMatch[1] : email.from.trim();
		return addr.toLowerCase() === decodedAuthorEmail.toLowerCase();
	});

	const fetchError = emailsData?.error ?? (isError ? String(error) : null);

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
			<main className="flex flex-1 flex-col">
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
			</main>
		</div>
	);
}
