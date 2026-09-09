import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DeleteActionPage } from "@/pages/DeleteActionPage";

export const Route = createFileRoute(
	"/account/$accountId/actions/$mailbox/delete/$authorEmail",
)({
	validateSearch: (search: Record<string, unknown>) => ({
		page: Number(search.page) || 1,
	}),
	component: AccountDeleteActionRoute,
});

function AccountDeleteActionRoute() {
	const { accountId, mailbox, authorEmail } = Route.useParams();
	const { page } = Route.useSearch();
	const navigate = useNavigate({
		from: "/account/$accountId/actions/$mailbox/delete/$authorEmail",
	});

	const mailboxPath = decodeURIComponent(mailbox);
	const decodedAuthorEmail = decodeURIComponent(authorEmail);

	return (
		<DeleteActionPage
			accountId={accountId}
			mailboxPath={mailboxPath}
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
