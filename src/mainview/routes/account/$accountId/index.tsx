import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { InboxPage } from "@/pages/InboxPage";

export const Route = createFileRoute("/account/$accountId/")({
	validateSearch: (search: Record<string, unknown>) => ({
		page: Number(search.page) || 1,
	}),
	component: AccountInboxRoute,
});

function AccountInboxRoute() {
	const { accountId } = Route.useParams();
	const { page } = Route.useSearch();
	const navigate = useNavigate({ from: "/account/$accountId/" });

	return (
		<InboxPage
			accountId={accountId}
			page={page}
			onPageChange={(p) => navigate({ search: { page: p } })}
		/>
	);
}
