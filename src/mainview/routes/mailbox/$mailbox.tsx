import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MailboxPage } from "@/pages/MailboxPage";

export const Route = createFileRoute("/mailbox/$mailbox")({
	validateSearch: (search: Record<string, unknown>) => ({
		page: Number(search.page) || 1,
	}),
	component: MailboxRoute,
});

function MailboxRoute() {
	const { mailbox: encodedMailbox } = Route.useParams();
	const { page } = Route.useSearch();
	const navigate = useNavigate({ from: "/mailbox/$mailbox" });
	const mailboxPath = decodeURIComponent(encodedMailbox);

	return (
		<MailboxPage
			mailboxPath={mailboxPath}
			page={page}
			onPageChange={(p) => navigate({ search: { page: p } })}
		/>
	);
}
