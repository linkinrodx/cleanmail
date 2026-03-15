import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
	CheckIcon,
	FolderInputIcon,
	Loader2Icon,
	MoveRightIcon,
} from "lucide-react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import type { EmailAction } from "@/contexts/ActionsContext";
import { useApplyActionContext } from "@/contexts/ApplyActionContext";
import { getMailboxShortLabel } from "../lib/mailbox-utils";

export function getActionHref(action: EmailAction): string {
	if (action.type === "move") {
		return `/actions/${encodeURIComponent(action.fromMailboxPath)}/move/${encodeURIComponent(action.authorEmail)}/to/${encodeURIComponent(action.toMailboxPath)}`;
	}
	return `/actions/${encodeURIComponent(action.mailboxPath)}/delete/${encodeURIComponent(action.authorEmail)}`;
}

function getActionTitle(action: EmailAction): string {
	if (action.type === "move") {
		return `Move from ${getMailboxShortLabel(action.fromMailboxPath)} to ${getMailboxShortLabel(action.toMailboxPath)}`;
	}
	return `Delete email of ${getMailboxShortLabel(action.mailboxPath)}`;
}

function getActionIcon(action: EmailAction): LucideIcon {
	if (action.type === "move") return MoveRightIcon;
	return FolderInputIcon;
}

type ActionItemProps = {
	action: EmailAction;
	currentHref: string;
	jobId?: string;
};

export function ActionItem({ action, currentHref, jobId }: ActionItemProps) {
	const href = getActionHref(action);
	const title = getActionTitle(action);
	const DefaultIcon = getActionIcon(action);
	const isActive = currentHref === href;

	const { jobs } = useApplyActionContext();
	const jobState = jobId ? jobs[jobId] : undefined;

	// Decide which icon to show based on job state
	let StatusIcon: LucideIcon = DefaultIcon;
	let iconClass: string | undefined;
	if (jobState?.status === "pending" || jobState?.status === "running") {
		StatusIcon = Loader2Icon;
		iconClass = "animate-spin";
	} else if (jobState?.status === "success") {
		StatusIcon = CheckIcon;
		iconClass = "text-green-500";
	}

	return (
		<SidebarMenuItem>
			<SidebarMenuButton isActive={isActive} title={title}>
				<Link to={href} className="flex items-center gap-2 w-full">
					<StatusIcon className={`shrink-0 size-4 ${iconClass ?? ""}`} />
					<span className="flex flex-col leading-tight min-w-0">
						<span className="truncate">{title}</span>
						<span className="truncate text-xs text-muted-foreground font-normal">
							{action.authorEmail}
						</span>
					</span>
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}
