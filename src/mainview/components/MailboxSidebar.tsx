import { useRouterState } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarRail,
} from "@/components/ui/sidebar";
import { useActionsContext } from "@/contexts/ActionsContext";
import { useMailboxes } from "@/hooks/queries/useMailboxes";
import {
	getMailboxLabel,
	getPinnedOrder,
	isPinned,
} from "../lib/mailbox-utils";
import { ActionItem, getActionHref } from "./ActionItem";
import { MailboxItem } from "./MailboxItem";
import { NewMailboxDialog } from "./NewMailboxDialog";

export function MailboxSidebar() {
	const { data, isLoading } = useMailboxes();
	const { actions, getId } = useActionsContext();
	const routerState = useRouterState();

	const currentPathname = routerState.location.pathname;

	const [dialogOpen, setDialogOpen] = useState(false);

	const mailboxes = data?.mailboxes ?? [];

	const pinned = mailboxes
		.filter(isPinned)
		.sort((a, b) => getPinnedOrder(a) - getPinnedOrder(b));

	// Deduplicate pinned (e.g. Sent / Sent Messages both present)
	const seenLabels = new Set<string>();
	const uniquePinned = pinned.filter((m) => {
		const label = getMailboxLabel(m);
		if (seenLabels.has(label)) return false;
		seenLabels.add(label);
		return true;
	});

	const rest = mailboxes
		.filter((m) => !isPinned(m))
		.sort((a, b) => getMailboxLabel(a).localeCompare(getMailboxLabel(b)));

	return (
		<>
			<Sidebar collapsible="icon">
				<SidebarContent>
					{/* Pinned / important mailboxes */}
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								{isLoading
									? Array.from({ length: 5 }).map((_, i) => (
											// biome-ignore lint/suspicious/noArrayIndexKey: skeleton list
											<SidebarMenuItem key={i}>
												<SidebarMenuSkeleton showIcon />
											</SidebarMenuItem>
										))
									: uniquePinned.map((mailbox) => (
											<MailboxItem
												key={mailbox.path}
												mailbox={mailbox}
												currentPathname={currentPathname}
											/>
										))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>

					{/* Separator between pinned and the rest */}
					{!isLoading && rest.length > 0 && (
						<>
							<Separator className="mx-2 w-auto" />

							<SidebarGroup>
								<SidebarGroupLabel>All Mailboxes</SidebarGroupLabel>
								<SidebarGroupContent>
									<SidebarMenu>
										{rest.map((mailbox) => (
											<MailboxItem
												key={mailbox.path}
												mailbox={mailbox}
												currentPathname={currentPathname}
											/>
										))}
									</SidebarMenu>
								</SidebarGroupContent>
							</SidebarGroup>
						</>
					)}

					{/* Actions group — shown only when there are recorded actions */}
					{actions.length > 0 && (
						<>
							<Separator className="mx-2 w-auto" />

							<SidebarGroup>
								<SidebarGroupLabel>Actions</SidebarGroupLabel>
								<SidebarGroupContent>
									<SidebarMenu>
										{actions.map((action) => (
											<ActionItem
												key={getActionHref(action)}
												action={action}
												currentHref={currentPathname}
												jobId={getId(action)}
											/>
										))}
									</SidebarMenu>
								</SidebarGroupContent>
							</SidebarGroup>
						</>
					)}
				</SidebarContent>

				<SidebarFooter>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton onClick={() => setDialogOpen(true)}>
								<PlusIcon />
								<span>New Mailbox</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>

				<SidebarRail />
			</Sidebar>

			<NewMailboxDialog open={dialogOpen} onOpenChange={setDialogOpen} />
		</>
	);
}
