import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
	ArchiveIcon,
	CheckIcon,
	FileEditIcon,
	FolderInputIcon,
	InboxIcon,
	Loader2Icon,
	MailIcon,
	MoveRightIcon,
	PlusIcon,
	SendIcon,
	ShieldAlertIcon,
	Trash2Icon,
	TriangleAlertIcon,
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarRail,
} from "@/components/ui/sidebar";
import { useCreateMailbox, useMailboxes } from "@/lib/queries/imap";
import type { Mailbox } from "../../shared/rpc-types";
import type { EmailAction } from "../routes/__root";
import {
	useActionsContext,
	useApplyActionContext,
	useDragContext,
} from "../routes/__root";

// Special-use attribute values per RFC 6154 + common Gmail/IMAP extensions
const SPECIAL_USE_ICONS: Record<string, LucideIcon> = {
	"\\Inbox": InboxIcon,
	"\\Sent": SendIcon,
	"\\Drafts": FileEditIcon,
	"\\Trash": Trash2Icon,
	"\\Junk": TriangleAlertIcon,
	"\\Spam": TriangleAlertIcon,
	"\\Archive": ArchiveIcon,
	"\\All": MailIcon,
};

// Well-known mailbox paths/names that should be pinned, in display order
const PINNED_PATHS = [
	"INBOX",
	"Sent",
	"Sent Messages",
	"Drafts",
	"Trash",
	"Spam",
	"Junk",
	"OUTBOX",
	"Outbox",
	"QUARANTAINE",
	"Quarantaine",
];
const PINNED_LABELS: Record<string, string> = {
	INBOX: "Inbox",
	Sent: "Sent",
	"Sent Messages": "Sent",
	Drafts: "Drafts",
	Trash: "Trash",
	Spam: "Spam",
	Junk: "Spam",
	OUTBOX: "Outbox",
	Outbox: "Outbox",
	QUARANTAINE: "Quarantaine",
	Quarantaine: "Quarantaine",
};
const PINNED_ICONS: Record<string, LucideIcon> = {
	INBOX: InboxIcon,
	Sent: SendIcon,
	"Sent Messages": SendIcon,
	Drafts: FileEditIcon,
	Trash: Trash2Icon,
	Spam: TriangleAlertIcon,
	Junk: TriangleAlertIcon,
	OUTBOX: SendIcon,
	Outbox: SendIcon,
	QUARANTAINE: ShieldAlertIcon,
	Quarantaine: ShieldAlertIcon,
};

function getMailboxIcon(mailbox: Mailbox): LucideIcon {
	if (mailbox.specialUse && SPECIAL_USE_ICONS[mailbox.specialUse]) {
		return SPECIAL_USE_ICONS[mailbox.specialUse];
	}
	const byPath = PINNED_ICONS[mailbox.path] ?? PINNED_ICONS[mailbox.name];
	return byPath ?? MailIcon;
}

function getMailboxLabel(mailbox: Mailbox): string {
	return (
		PINNED_LABELS[mailbox.path] ?? PINNED_LABELS[mailbox.name] ?? mailbox.name
	);
}

function isPinned(mailbox: Mailbox): boolean {
	return (
		PINNED_PATHS.includes(mailbox.path) ||
		PINNED_PATHS.includes(mailbox.name) ||
		mailbox.path === "INBOX" ||
		mailbox.specialUse === "\\Inbox" ||
		mailbox.specialUse === "\\Sent" ||
		mailbox.specialUse === "\\Drafts" ||
		mailbox.specialUse === "\\Trash" ||
		mailbox.specialUse === "\\Junk" ||
		mailbox.specialUse === "\\Spam"
	);
}

const PINNED_ORDER: Record<string, number> = {
	INBOX: 0,
	Inbox: 0,
	Sent: 1,
	"Sent Messages": 1,
	Drafts: 2,
	Trash: 3,
	Spam: 4,
	Junk: 4,
	OUTBOX: 5,
	Outbox: 5,
	QUARANTAINE: 6,
	Quarantaine: 6,
};

function getPinnedOrder(mailbox: Mailbox): number {
	return PINNED_ORDER[mailbox.path] ?? PINNED_ORDER[mailbox.name] ?? 99;
}

type MailboxItemProps = {
	mailbox: Mailbox;
	currentPathname: string;
};

function MailboxItem({ mailbox, currentPathname }: MailboxItemProps) {
	const Icon = getMailboxIcon(mailbox);
	const label = getMailboxLabel(mailbox);

	// "/" maps to INBOX; all others use "/mailbox/<encoded>"
	const href =
		mailbox.path === "INBOX"
			? "/"
			: `/mailbox/${encodeURIComponent(mailbox.path)}`;
	const isActive =
		mailbox.path === "INBOX"
			? currentPathname === "/"
			: currentPathname === `/mailbox/${encodeURIComponent(mailbox.path)}`;

	const { draggingUid, onDropToMailbox, setDraggingUid } = useDragContext();
	const [isDragOver, setIsDragOver] = useState(false);

	// Only show drop target when there's an active drag and it's not the current mailbox
	const isDroppable = draggingUid !== null && !isActive;

	function handleDragOver(e: React.DragEvent<HTMLLIElement>) {
		if (!isDroppable) return;
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
		if (!isDroppable) return;
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
			{mailbox.unreadCount > 0 && (
				<SidebarMenuBadge>{mailbox.unreadCount}</SidebarMenuBadge>
			)}
		</SidebarMenuItem>
	);
}

function getMailboxShortLabel(mailboxPath: string): string {
	if (mailboxPath === "INBOX") return "Inbox";
	return mailboxPath.split(/[./\\]/).pop() ?? mailboxPath;
}

function getActionHref(action: EmailAction): string {
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

function ActionItem({ action, currentHref, jobId }: ActionItemProps) {
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

export function MailboxSidebar() {
	const { data, isLoading } = useMailboxes();
	const createMailbox = useCreateMailbox();
	const { actions, getCreatedAt } = useActionsContext();
	const routerState = useRouterState();

	const currentPathname = routerState.location.pathname;

	const [dialogOpen, setDialogOpen] = useState(false);
	const [newMailboxName, setNewMailboxName] = useState("");

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

	function handleCreateMailbox() {
		const name = newMailboxName.trim();
		if (!name) return;
		createMailbox.mutate(name, {
			onSuccess: () => {
				setDialogOpen(false);
				setNewMailboxName("");
			},
		});
	}

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
												jobId={getCreatedAt(action)}
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

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
								if (e.key === "Enter") handleCreateMailbox();
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
						<Button
							variant="outline"
							onClick={() => {
								setDialogOpen(false);
								setNewMailboxName("");
								createMailbox.reset();
							}}
						>
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
		</>
	);
}
