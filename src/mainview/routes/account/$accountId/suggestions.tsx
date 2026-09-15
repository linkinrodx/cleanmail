import { createFileRoute } from "@tanstack/react-router";
import { SuggestionsPage } from "@/pages/SuggestionsPage";

export const Route = createFileRoute("/account/$accountId/suggestions")({
	component: SuggestionsRoute,
});

function SuggestionsRoute() {
	const { accountId } = Route.useParams();
	return <SuggestionsPage accountId={accountId} />;
}
