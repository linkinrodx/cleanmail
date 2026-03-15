import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { InboxPage } from "@/pages/InboxPage";

export const Route = createFileRoute("/")({
	validateSearch: (search: Record<string, unknown>) => ({
		page: Number(search.page) || 1,
	}),
	component: IndexRoute,
});

function IndexRoute() {
	const { page } = Route.useSearch();
	const navigate = useNavigate({ from: "/" });

	return (
		<InboxPage
			page={page}
			onPageChange={(p) => navigate({ search: { page: p } })}
		/>
	);
}
