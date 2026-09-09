import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
	CheckIcon,
	FolderInputIcon,
	Loader2Icon,
	MoveRightIcon,
	PlayIcon,
	Trash2Icon,
} from "lucide-react";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import type { EmailAction } from "@/contexts/ActionsContext";
import { useActionsContext } from "@/contexts/ActionsContext";
import { useApplyActionContext } from "@/contexts/ApplyActionContext";
import { useApplyDeleteAction } from "@/hooks/mutations/useApplyDeleteAction";
import { useApplyMoveAction } from "@/hooks/mutations/useApplyMoveAction";
import { useRemoveAction } from "@/hooks/mutations/useRemoveAction";
import { getMailboxShortLabel } from "../lib/mailbox-utils";

export function getActionHref(action: EmailAction): string {
	if (action.type === "move") {
		return `/account/${action.accountId}/actions/${encodeURIComponent(action.fromMailboxPath)}/move/${encodeURIComponent(action.authorEmail)}/to/${encodeURIComponent(action.toMailboxPath)}`;
	}
	return `/account/${action.accountId}/actions/${encodeURIComponent(action.mailboxPath)}/delete/${encodeURIComponent(action.authorEmail)}`;
}

function getActionTitle(action: EmailAction): string {
	if (action.type === "move") {
		return `Move from ${getMailboxShortLabel(action.fromMailboxPath)} to ${getMailboxShortLabel(action.toMailboxPath)}`;
	}
	return `Delete email of ${getMailboxShortLabel(action.mailboxPath)}`;
}

function getActionIcon(action: EmailAction): LucideIcon {
	if (action.type === "move") {
		return MoveRightIcon;
	}
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

	const { jobs, setJobStatus } = useApplyActionContext();
	const jobState = jobId ? jobs[jobId] : undefined;

	const { getId } = useActionsContext();
	const applyMove = useApplyMoveAction(action.accountId);
	const applyDelete = useApplyDeleteAction(action.accountId);
	const removeAction = useRemoveAction();

	// Decide which icon to show based on job state
	let StatusIcon: LucideIcon = DefaultIcon;
	let iconClass: string | undefined;
	let isJobRunning = false;
	let isJobSuccess = false;

	if (jobState?.status === "pending" || jobState?.status === "running") {
		StatusIcon = Loader2Icon;
		iconClass = "animate-spin";
		isJobRunning = true;
	} else if (jobState?.status === "success") {
		StatusIcon = CheckIcon;
		isJobSuccess = true;
	}

	// Base color per action type, overridden by job state
	const iconContainerClass = isJobSuccess
		? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
		: isJobRunning
			? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
			: action.type === "move"
				? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
				: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

	// Subtitle: show mailbox context
	const subtitle =
		action.type === "move"
			? `${getMailboxShortLabel(action.fromMailboxPath)} → ${getMailboxShortLabel(action.toMailboxPath)}`
			: getMailboxShortLabel(action.mailboxPath);

	function handleApply() {
		const resolvedId = getId(action);
		if (!resolvedId) {
			return;
		}

		setJobStatus(resolvedId, { status: "pending" });

		if (action.type === "move") {
			applyMove.mutate({
				jobId: resolvedId,
				accountId: action.accountId,
				authorEmail: action.authorEmail,
				fromMailboxPath: action.fromMailboxPath,
				toMailboxPath: action.toMailboxPath,
			});
		} else {
			applyDelete.mutate({
				jobId: resolvedId,
				accountId: action.accountId,
				authorEmail: action.authorEmail,
				mailboxPath: action.mailboxPath,
			});
		}
	}

	function handleDelete() {
		const resolvedId = getId(action);
		if (!resolvedId) {
			return;
		}

		removeAction.mutate(resolvedId);
	}

	return (
		<SidebarMenuItem>
			<ContextMenu>
				<ContextMenuTrigger>
					<SidebarMenuButton
						isActive={isActive}
						title={title}
						className="h-auto py-0"
					>
						<Link to={href} className="flex items-center gap-2.5 w-full py-2.5">
							<div
								className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${iconContainerClass}`}
							>
								<StatusIcon className={`size-4 ${iconClass ?? ""}`} />
							</div>
							<span className="flex flex-col gap-0.5 leading-none min-w-0">
								<span className="flex items-center gap-1.5 min-w-0">
									<span className="truncate text-xs text-muted-foreground">
										{subtitle}
									</span>
								</span>
								<span className="truncate text-xs font-medium text-foreground/90 pl-0.5">
									{action.authorEmail}
								</span>
							</span>
						</Link>
					</SidebarMenuButton>
				</ContextMenuTrigger>

				<ContextMenuContent>
					<ContextMenuItem onClick={handleApply}>
						<PlayIcon />
						Apply
					</ContextMenuItem>
					<ContextMenuSeparator />
					<ContextMenuItem variant="destructive" onClick={handleDelete}>
						<Trash2Icon />
						Delete
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>
		</SidebarMenuItem>
	);
}
