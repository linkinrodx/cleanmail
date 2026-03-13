import type { LucideIcon } from "lucide-react";
import {
	ArchiveIcon,
	FileEditIcon,
	InboxIcon,
	MailIcon,
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
	activeMailboxPath: string;
	onSelect: (path: string) => void;
};

function MailboxItem({
	mailbox,
	activeMailboxPath,
	onSelect,
}: MailboxItemProps) {
	const Icon = getMailboxIcon(mailbox);
	const label = getMailboxLabel(mailbox);
	const isActive = mailbox.path === activeMailboxPath;

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				isActive={isActive}
				onClick={() => onSelect(mailbox.path)}
				title={mailbox.path}
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

type MailboxSidebarProps = {
	activeMailboxPath: string;
	onSelectMailbox: (path: string) => void;
};

export function MailboxSidebar({
	activeMailboxPath,
	onSelectMailbox,
}: MailboxSidebarProps) {
	const { data, isLoading } = useMailboxes();
	const createMailbox = useCreateMailbox();

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
												activeMailboxPath={activeMailboxPath}
												onSelect={onSelectMailbox}
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
												activeMailboxPath={activeMailboxPath}
												onSelect={onSelectMailbox}
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
