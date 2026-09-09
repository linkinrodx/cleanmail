import { createFileRoute, Link } from "@tanstack/react-router";
import { MailPlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ImapSetupDialog } from "@/components/ImapSetupDialog";
import { Button } from "@/components/ui/button";
import { useRemoveAccount } from "@/hooks/mutations/useRemoveAccount";
import { useAccounts } from "@/hooks/queries/useAccounts";

export const Route = createFileRoute("/")({
	component: IndexRoute,
});

function IndexRoute() {
	const { accounts, isLoading } = useAccounts();
	const removeAccount = useRemoveAccount();
	const [setupOpen, setSetupOpen] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const handleDelete = async (id: string, email: string) => {
		const ok = window.confirm(`Delete account ${email}?`);
		if (!ok) return;

		setDeletingId(id);
		try {
			const res = await removeAccount.mutateAsync({ id });
			if (res.success) {
				toast.success(`Account ${email} deleted`);
			} else {
				toast.error(res.error ?? "Could not delete account");
			}
		} finally {
			setDeletingId(null);
		}
	};

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<p className="text-sm text-muted-foreground">Loading…</p>
			</div>
		);
	}

	if (accounts.length === 0) {
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

	return (
		<div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
			<div className="w-full max-w-lg space-y-6">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
					<Button onClick={() => setSetupOpen(true)}>
						<MailPlusIcon className="mr-2 size-4" />
						Add account
					</Button>
				</div>

				<ul className="space-y-3">
					{accounts.map((account) => (
						<li key={account.id}>
							<div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
								<Link
									to="/account/$accountId"
									params={{ accountId: account.id }}
									search={{ page: 1 }}
									className="flex flex-col gap-1 min-w-0"
								>
									<span className="truncate text-sm font-medium">
										{account.email}
									</span>
									<span className="text-xs text-muted-foreground">
										{account.provider} · {account.authMethod}
									</span>
								</Link>

								<Button
									variant="ghost"
									size="icon"
									disabled={deletingId === account.id}
									onClick={() => handleDelete(account.id, account.email)}
								>
									<Trash2Icon className="size-4" />
								</Button>
							</div>
						</li>
					))}
				</ul>
			</div>

			<ImapSetupDialog open={setupOpen} onOpenChange={setSetupOpen} />
		</div>
	);
}
