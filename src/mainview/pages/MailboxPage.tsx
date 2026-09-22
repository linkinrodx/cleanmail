import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { EmailsPagination } from "@/components/EmailsPagination";
import { EmailTable } from "@/components/EmailTable";
import { Button } from "@/components/ui/button";
import {
	EMAILS_PER_PAGE,
	prefetchEmails,
	useEmails,
} from "@/hooks/queries/useEmails";
import { TopBar } from "@/components/TopBar";

type MailboxPageProps = {
	accountId: string;
	mailboxPath: string;
	page: number;
	onPageChange: (page: number) => void;
};

export function MailboxPage({
	accountId,
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
	} = useEmails(accountId, mailboxPath, { page });

	const emails = emailsData?.emails ?? [];
	const total = emailsData?.total ?? 0;
	const fetchError = emailsData?.error ?? (isError ? String(error) : null);

	// Prefetch adjacent pages once we know the total so navigation feels instant
	useEffect(() => {
		if (!total) {
			return;
		}

		const totalPages = Math.ceil(total / EMAILS_PER_PAGE);

		if (page > 1) {
			prefetchEmails(queryClient, accountId, mailboxPath, { page: page - 1 });
		}
		if (page < totalPages) {
			prefetchEmails(queryClient, accountId, mailboxPath, { page: page + 1 });
		}
	}, [queryClient, accountId, mailboxPath, page, total]);

	const mailboxDisplayName =
		mailboxPath === "INBOX"
			? "Inbox"
			: (mailboxPath.split(/[./\\]/).pop() ?? mailboxPath);

	// Scroll restoration
	const mainRef = useRef<HTMLElement | null>(null);
	const restoredRef = useRef(false);
	const scrollKey = `scroll:${accountId}:${mailboxPath}`;

	useEffect(() => {
		if (restoredRef.current) return;
		const el = mainRef.current;
		if (!el || emails.length === 0) return;
		const saved = sessionStorage.getItem(scrollKey);
		if (saved) el.scrollTop = Number(saved);
		restoredRef.current = true;
	}, [emails.length, scrollKey]);

	function handleScroll(e: React.UIEvent<HTMLElement>) {
		sessionStorage.setItem(scrollKey, String(e.currentTarget.scrollTop));
	}

	return (
		<div className="flex h-svh w-full min-w-0 flex-col overflow-hidden bg-background">
			<header className="shrink-0">
				<TopBar
					title={mailboxDisplayName}
					isLoading={emailsLoading}
					refetch={refetch}
				/>
			</header>

			{/* Main content */}
			<main
				ref={mainRef}
				onScroll={handleScroll}
				className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto"
			>
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
						<EmailTable
							emails={emails}
							accountId={accountId}
							mailboxPath={mailboxPath}
						/>
					</>
				)}
			</main>
		</div>
	);
}
