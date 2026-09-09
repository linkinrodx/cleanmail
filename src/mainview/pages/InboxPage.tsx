import { useState } from "react";
import { EmailsPagination } from "@/components/EmailsPagination";
import { EmailTable } from "@/components/EmailTable";
import { ImapSetupDialog } from "@/components/ImapSetupDialog";
import { Button } from "@/components/ui/button";
import { useEmails } from "@/hooks/queries/useEmails";
import { TopBar } from "@/components/TopBar";

type InboxPageProps = {
	accountId: string;
	page: number;
	onPageChange: (page: number) => void;
};

export function InboxPage({ accountId, page, onPageChange }: InboxPageProps) {
	const activeMailboxPath = "INBOX";

	const [setupOpen, setSetupOpen] = useState(false);

	const {
		data: emailsData,
		isLoading: emailsLoading,
		isError,
		error,
		refetch,
	} = useEmails(accountId, activeMailboxPath, { page });

	const emails = emailsData?.emails ?? [];
	const total = emailsData?.total ?? 0;
	const fetchError = emailsData?.error ?? (isError ? String(error) : null);

	const isLoading = emailsLoading;

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<TopBar
				title="Inbox"
				isLoading={isLoading}
				refetch={refetch}
				setSetupOpen={setSetupOpen}
			/>

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
					<>
						<EmailsPagination
							page={page}
							total={total}
							onPageChange={onPageChange}
						/>
						<EmailTable
							emails={emails}
							accountId={accountId}
							mailboxPath={activeMailboxPath}
						/>
					</>
				)}
			</main>

			<ImapSetupDialog open={setupOpen} onOpenChange={setSetupOpen} />
		</div>
	);
}
