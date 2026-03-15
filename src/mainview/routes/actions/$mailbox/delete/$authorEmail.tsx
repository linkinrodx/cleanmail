import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DeleteActionPage } from "@/pages/DeleteActionPage";

export const Route = createFileRoute("/actions/$mailbox/delete/$authorEmail")({
	validateSearch: (search: Record<string, unknown>) => ({
		page: Number(search.page) || 1,
	}),
	component: DeleteActionRoute,
});

function DeleteActionRoute() {
	const { mailbox, authorEmail } = Route.useParams();
	const { page } = Route.useSearch();
	const navigate = useNavigate({
		from: "/actions/$mailbox/delete/$authorEmail",
	});

	const mailboxPath = decodeURIComponent(mailbox);
	const decodedAuthorEmail = decodeURIComponent(authorEmail);

	return (
		<DeleteActionPage
			mailboxPath={mailboxPath}
			authorEmail={authorEmail}
			decodedAuthorEmail={decodedAuthorEmail}
			page={page}
			onPageChange={(p) => navigate({ search: { page: p } })}
			onSuccess={() => navigate({ to: "/", search: { page: 1 } })}
		/>
	);
}
