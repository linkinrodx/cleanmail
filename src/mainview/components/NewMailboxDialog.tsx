import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateMailbox } from "@/hooks/mutations/useCreateMailbox";

type NewMailboxDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function NewMailboxDialog({
	open,
	onOpenChange,
}: NewMailboxDialogProps) {
	const createMailbox = useCreateMailbox();
	const [newMailboxName, setNewMailboxName] = useState("");

	function handleCreateMailbox() {
		const name = newMailboxName.trim();
		if (!name) {
			return;
		}

		createMailbox.mutate(name, {
			onSuccess: () => {
				onOpenChange(false);
				setNewMailboxName("");
			},
		});
	}

	function handleCancel() {
		onOpenChange(false);
		setNewMailboxName("");
		createMailbox.reset();
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New Mailbox</DialogTitle>
				</DialogHeader>

				<div className="grid gap-2 py-2">
					<Label htmlFor="mailbox-name">Name</Label>
					<Input
						id="mailbox-name"
						placeholder="e.g. Projects"
						value={newMailboxName}
						onChange={(e) => setNewMailboxName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								handleCreateMailbox();
							}
						}}
						autoFocus
					/>
					{createMailbox.error && (
						<p className="text-sm text-destructive">
							{createMailbox.error instanceof Error
								? createMailbox.error.message
								: "Failed to create mailbox"}
						</p>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleCancel}>
						Cancel
					</Button>
					<Button
						onClick={handleCreateMailbox}
						disabled={!newMailboxName.trim() || createMailbox.isPending}
					>
						{createMailbox.isPending ? "Creating…" : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
