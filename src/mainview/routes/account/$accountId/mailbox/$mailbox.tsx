import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MailboxPage } from "@/pages/MailboxPage";

export const Route = createFileRoute("/account/$accountId/mailbox/$mailbox")({
	validateSearch: (search: Record<string, unknown>) => ({
		page: Number(search.page) || 1,
	}),
	component: AccountMailboxRoute,
});

function AccountMailboxRoute() {
	const { accountId, mailbox: encodedMailbox } = Route.useParams();
	const { page } = Route.useSearch();
	const navigate = useNavigate({
		from: "/account/$accountId/mailbox/$mailbox",
	});
	const mailboxPath = decodeURIComponent(encodedMailbox);

	return (
		<MailboxPage
			accountId={accountId}
			mailboxPath={mailboxPath}
			page={page}
			onPageChange={(p) => navigate({ search: { page: p } })}
		/>
	);
}
