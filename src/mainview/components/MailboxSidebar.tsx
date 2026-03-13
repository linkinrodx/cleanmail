import type { LucideIcon } from "lucide-react";
import {
	ArchiveIcon,
	FileEditIcon,
	InboxIcon,
	MailIcon,
	SendIcon,
	Trash2Icon,
	TriangleAlertIcon,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
	Sidebar,
	SidebarContent,
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
import { useMailboxes } from "@/lib/queries/imap";
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
];
const PINNED_LABELS: Record<string, string> = {
	INBOX: "Inbox",
	Sent: "Sent",
	"Sent Messages": "Sent",
	Drafts: "Drafts",
	Trash: "Trash",
	Spam: "Spam",
	Junk: "Spam",
};
const PINNED_ICONS: Record<string, LucideIcon> = {
	INBOX: InboxIcon,
	Sent: SendIcon,
	"Sent Messages": SendIcon,
	Drafts: FileEditIcon,
	Trash: Trash2Icon,
	Spam: TriangleAlertIcon,
	Junk: TriangleAlertIcon,
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

			<SidebarRail />
		</Sidebar>
	);
}
