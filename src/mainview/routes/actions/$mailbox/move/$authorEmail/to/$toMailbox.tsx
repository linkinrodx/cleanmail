import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MoveActionPage } from "@/pages/MoveActionPage";

export const Route = createFileRoute(
	"/actions/$mailbox/move/$authorEmail/to/$toMailbox",
)({
	validateSearch: (search: Record<string, unknown>) => ({
		page: Number(search.page) || 1,
	}),
	component: MoveActionRoute,
});

function MoveActionRoute() {
	const { mailbox, authorEmail, toMailbox } = Route.useParams();
	const { page } = Route.useSearch();
	const navigate = useNavigate({
		from: "/actions/$mailbox/move/$authorEmail/to/$toMailbox",
	});

	const fromMailboxPath = decodeURIComponent(mailbox);
	const toMailboxPath = decodeURIComponent(toMailbox);
	const decodedAuthorEmail = decodeURIComponent(authorEmail);

	return (
		<MoveActionPage
			fromMailboxPath={fromMailboxPath}
			toMailboxPath={toMailboxPath}
			authorEmail={authorEmail}
			decodedAuthorEmail={decodedAuthorEmail}
			page={page}
			onPageChange={(p) => navigate({ search: { page: p } })}
			onSuccess={() => navigate({ to: "/", search: { page: 1 } })}
		/>
	);
}
