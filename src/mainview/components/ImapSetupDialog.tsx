import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useBeginOAuth } from "@/hooks/mutations/useBeginOAuth";
import type { AccountProvider } from "../../shared/rpc-types";
import { ImapSetupForm } from "./ImapSetupForm";

type ImapSetupDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function ImapSetupDialog({ open, onOpenChange }: ImapSetupDialogProps) {
	const { mutateAsync: beginOAuth, isPending } = useBeginOAuth();

	const handleOAuth = async (provider: AccountProvider) => {
		try {
			const result = await beginOAuth({ provider });
			if (result.error) {
				toast.error(result.error);
				return;
			}
			toast.success("Complete sign-in in your browser");
			onOpenChange(false);
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Could not start the connection",
			);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Add account</DialogTitle>
					<DialogDescription>
						Connect your email with OAuth or use IMAP with a password.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-2">
					<Button
						variant="outline"
						onClick={() => handleOAuth("gmail")}
						disabled={isPending}
					>
						Continue with Google
					</Button>
					<Button
						variant="outline"
						onClick={() => handleOAuth("outlook")}
						disabled={isPending}
					>
						Continue with Microsoft
					</Button>
				</div>

				<div className="my-2 text-center text-xs text-muted-foreground">
					or use IMAP with a password
				</div>

				<ImapSetupForm onAdded={() => onOpenChange(false)} />
			</DialogContent>
		</Dialog>
	);
}
