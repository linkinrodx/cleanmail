import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GroupDetailPage } from "@/pages/GroupDetailPage";

export const Route = createFileRoute(
	"/account/$accountId/group/$mailbox/$authorEmail",
)({
	validateSearch: (search: Record<string, unknown>) => ({
		page: Number(search.page) || 1,
	}),
	component: AccountGroupDetailRoute,
});

function AccountGroupDetailRoute() {
	const { accountId, mailbox, authorEmail } = Route.useParams();
	const { page } = Route.useSearch();
	const navigate = useNavigate({
		from: "/account/$accountId/group/$mailbox/$authorEmail",
	});

	const mailboxPath = decodeURIComponent(mailbox);
	const decodedAuthorEmail = decodeURIComponent(authorEmail);

	return (
		<GroupDetailPage
			accountId={accountId}
			mailboxPath={mailboxPath}
			authorEmail={authorEmail}
			decodedAuthorEmail={decodedAuthorEmail}
			page={page}
			onPageChange={(p) => navigate({ search: { page: p } })}
			onBack={() =>
				navigate({
					to: "/account/$accountId/suggestions",
					params: { accountId },
				})
			}
		/>
	);
}
