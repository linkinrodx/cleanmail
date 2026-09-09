import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ImapSetupDialog } from "@/components/ImapSetupDialog";
import { useAccounts } from "@/hooks/queries/useAccounts";

export const Route = createFileRoute("/")({
	component: IndexRoute,
});

function IndexRoute() {
	const { accounts, isLoading } = useAccounts();
	const [setupOpen, setSetupOpen] = useState(false);

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<p className="text-sm text-muted-foreground">Loading…</p>
			</div>
		);
	}

	if (accounts.length > 0) {
		return (
			<Navigate
				to="/account/$accountId"
				params={{ accountId: accounts[0].id }}
				search={{ page: 1 }}
			/>
		);
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
			<h1 className="text-2xl font-bold tracking-tight">CleanMail</h1>
			<p className="text-sm text-muted-foreground">
				Connect your first email account
			</p>
			<Button onClick={() => setSetupOpen(true)}>Add account</Button>

			<ImapSetupDialog open={setupOpen} onOpenChange={setSetupOpen} />
		</div>
	);
}
