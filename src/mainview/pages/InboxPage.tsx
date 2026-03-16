import { useState } from "react";
import { EmailsPagination } from "@/components/EmailsPagination";
import { EmailTable } from "@/components/EmailTable";
import { ImapSetupDialog } from "@/components/ImapSetupDialog";
import { Button } from "@/components/ui/button";
import { useEmails } from "@/hooks/queries/useEmails";
import { useImapConfig } from "@/hooks/queries/useImapConfig";
import { TopBar } from "@/components/TopBar";

type InboxPageProps = {
	page: number;
	onPageChange: (page: number) => void;
};

export function InboxPage({ page, onPageChange }: InboxPageProps) {
	const activeMailboxPath = "INBOX";

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
			<TopBar
				title="Inbox"
				isLoading={isLoading}
				refetch={refetch}
				setSetupOpen={setSetupOpen}
			/>

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
							onPageChange={onPageChange}
						/>
						<EmailTable emails={emails} mailboxPath={activeMailboxPath} />
					</>
				)}
			</main>

			<ImapSetupDialog open={setupOpen} onOpenChange={setSetupOpen} />
		</div>
	);
}
