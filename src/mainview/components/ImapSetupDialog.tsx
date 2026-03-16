import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useSaveImapConfig } from "@/hooks/mutations/useSaveImapConfig";
import { useImapConfig } from "@/hooks/queries/useImapConfig";
import { ImapSetupForm } from "./ImapSetupForm";

type ImapSetupDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function ImapSetupDialog({ open, onOpenChange }: ImapSetupDialogProps) {
	const { data: existingConfig } = useImapConfig();
	const { mutateAsync: saveConfig } = useSaveImapConfig();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Configure IMAP Account</DialogTitle>
					<DialogDescription>
						Enter your mail server details to connect your inbox.
					</DialogDescription>
				</DialogHeader>

				<ImapSetupForm
					existingConfig={existingConfig ?? null}
					onSave={async (values) => {
						await saveConfig(values);
						onOpenChange(false);
					}}
					onCancel={existingConfig ? () => onOpenChange(false) : undefined}
				/>
			</DialogContent>
		</Dialog>
	);
}
