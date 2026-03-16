import type { LucideIcon } from "lucide-react";
import {
	ArchiveIcon,
	FileEditIcon,
	InboxIcon,
	MailIcon,
	SendIcon,
	ShieldAlertIcon,
	Trash2Icon,
	TriangleAlertIcon,
} from "lucide-react";
import type { Mailbox } from "../../shared/rpc-types";

// Special-use attribute values per RFC 6154 + common Gmail/IMAP extensions
export const SPECIAL_USE_ICONS: Record<string, LucideIcon> = {
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
export const PINNED_PATHS = [
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

export const PINNED_LABELS: Record<string, string> = {
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

export const PINNED_ICONS: Record<string, LucideIcon> = {
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

export const PINNED_ORDER: Record<string, number> = {
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

export function getMailboxIcon(mailbox: Mailbox): LucideIcon {
	if (mailbox.specialUse && SPECIAL_USE_ICONS[mailbox.specialUse]) {
		return SPECIAL_USE_ICONS[mailbox.specialUse];
	}
	const byPath = PINNED_ICONS[mailbox.path] ?? PINNED_ICONS[mailbox.name];
	return byPath ?? MailIcon;
}

export function getMailboxLabel(mailbox: Mailbox): string {
	return (
		PINNED_LABELS[mailbox.path] ?? PINNED_LABELS[mailbox.name] ?? mailbox.name
	);
}

export function isPinned(mailbox: Mailbox): boolean {
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

export function getPinnedOrder(mailbox: Mailbox): number {
	return PINNED_ORDER[mailbox.path] ?? PINNED_ORDER[mailbox.name] ?? 99;
}

export function getMailboxShortLabel(mailboxPath: string): string {
	if (mailboxPath === "INBOX") {
		return "Inbox";
	}
	return mailboxPath.split(/[./\\]/).pop() ?? mailboxPath;
}
