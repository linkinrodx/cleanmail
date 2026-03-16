import { Settings2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

type ImapSetupTriggerProps = {
	onOpenChange: (open: boolean) => void;
};

export function ImapSetupTrigger({ onOpenChange }: ImapSetupTriggerProps) {
	return (
		<Button
			variant="ghost"
			size="icon-sm"
			onClick={() => onOpenChange(true)}
			title="Configure IMAP"
		>
			<Settings2Icon data-icon="inline" />
			<span className="sr-only">Configure IMAP</span>
		</Button>
	);
}
