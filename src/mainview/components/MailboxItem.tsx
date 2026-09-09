import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useDragContext } from "@/contexts/DragContext";
import type { Mailbox } from "../../shared/rpc-types";
import { getMailboxIcon, getMailboxLabel } from "../lib/mailbox-utils";

type MailboxItemProps = {
	mailbox: Mailbox;
	accountId: string;
	currentPathname: string;
};

export function MailboxItem({
	mailbox,
	accountId,
	currentPathname,
}: MailboxItemProps) {
	const Icon = getMailboxIcon(mailbox);
	const label = getMailboxLabel(mailbox);

	const href =
		mailbox.path === "INBOX"
			? `/account/${accountId}`
			: `/account/${accountId}/mailbox/${encodeURIComponent(mailbox.path)}`;
	const isActive =
		mailbox.path === "INBOX"
			? currentPathname === `/account/${accountId}` ||
				currentPathname === `/account/${accountId}/`
			: currentPathname ===
				`/account/${accountId}/mailbox/${encodeURIComponent(mailbox.path)}`;

	const { draggingUid, onDropToMailbox, setDraggingUid } = useDragContext();
	const [isDragOver, setIsDragOver] = useState(false);

	// Only show drop target when there's an active drag and it's not the current mailbox
	const isDroppable = draggingUid !== null && !isActive;

	function handleDragOver(e: React.DragEvent<HTMLLIElement>) {
		if (!isDroppable) {
			return;
		}

		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setIsDragOver(true);
	}

	function handleDragLeave(e: React.DragEvent<HTMLLIElement>) {
		// Only clear if we're leaving the element (not entering a child)
		if (!e.currentTarget.contains(e.relatedTarget as Node)) {
			setIsDragOver(false);
		}
	}

	function handleDrop(e: React.DragEvent<HTMLLIElement>) {
		e.preventDefault();
		setIsDragOver(false);

		if (!isDroppable) {
			return;
		}

		setDraggingUid(null);
		onDropToMailbox(mailbox.path);
	}

	return (
		<SidebarMenuItem
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			className={
				isDragOver
					? "rounded-md ring-2 ring-primary ring-offset-1 ring-offset-sidebar bg-primary/10"
					: isDroppable
						? "rounded-md ring-1 ring-border/60 transition-all"
						: undefined
			}
		>
			<SidebarMenuButton
				isActive={isActive}
				title={mailbox.path}
				className={isDragOver ? "pointer-events-none" : undefined}
				render={<Link to={href} />}
			>
				<Icon />
				<span>{label}</span>
			</SidebarMenuButton>

			{mailbox.unreadCount > 0 ? (
				<SidebarMenuBadge>{mailbox.unreadCount}</SidebarMenuBadge>
			) : null}
		</SidebarMenuItem>
	);
}
