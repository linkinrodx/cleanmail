import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MoveActionPage } from "@/pages/MoveActionPage";

export const Route = createFileRoute(
	"/account/$accountId/actions/$mailbox/move/$authorEmail/to/$toMailbox",
)({
	validateSearch: (search: Record<string, unknown>) => ({
		page: Number(search.page) || 1,
	}),
	component: AccountMoveActionRoute,
});

function AccountMoveActionRoute() {
	const { accountId, mailbox, authorEmail, toMailbox } = Route.useParams();
	const { page } = Route.useSearch();
	const navigate = useNavigate({
		from: "/account/$accountId/actions/$mailbox/move/$authorEmail/to/$toMailbox",
	});

	const fromMailboxPath = decodeURIComponent(mailbox);
	const toMailboxPath = decodeURIComponent(toMailbox);
	const decodedAuthorEmail = decodeURIComponent(authorEmail);

	return (
		<MoveActionPage
			accountId={accountId}
			fromMailboxPath={fromMailboxPath}
			toMailboxPath={toMailboxPath}
			authorEmail={authorEmail}
			decodedAuthorEmail={decodedAuthorEmail}
			page={page}
			onPageChange={(p) => navigate({ search: { page: p } })}
			onSuccess={() =>
				navigate({
					to: "/account/$accountId",
					params: { accountId },
					search: { page: 1 },
				})
			}
		/>
	);
}
