import { useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { useEffect } from "react";
import { EmailsPagination } from "@/components/EmailsPagination";
import { EmailTable } from "@/components/EmailTable";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
	EMAILS_PER_PAGE,
	prefetchEmails,
	useEmails,
} from "@/hooks/queries/useEmails";

type MailboxPageProps = {
	mailboxPath: string;
	page: number;
	onPageChange: (page: number) => void;
};

export function MailboxPage({
	mailboxPath,
	page,
	onPageChange,
}: MailboxPageProps) {
	const queryClient = useQueryClient();

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

	// Prefetch adjacent pages once we know the total so navigation feels instant
	useEffect(() => {
		if (!total) return;

		const totalPages = Math.ceil(total / EMAILS_PER_PAGE);

		if (page > 1) {
			prefetchEmails(queryClient, mailboxPath, { page: page - 1 });
		}
		if (page < totalPages) {
			prefetchEmails(queryClient, mailboxPath, { page: page + 1 });
		}
	}, [queryClient, mailboxPath, page, total]);

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
							onPageChange={onPageChange}
						/>
						<EmailTable emails={emails} mailboxPath={mailboxPath} />
					</>
				)}
			</main>
		</div>
	);
}
