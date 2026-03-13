import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: IndexPage,
});

function IndexPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<h1 className="text-4xl font-bold">CleanMail</h1>
		</div>
	);
}
