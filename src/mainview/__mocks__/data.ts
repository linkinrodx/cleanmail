import { faker } from "@faker-js/faker";
import type {
	Email,
	EmailDetail,
	Mailbox,
	PersistedAction,
} from "../../shared/rpc-types";

faker.seed(42);

// ---------------------------------------------------------------------------
// Mailboxes
// ---------------------------------------------------------------------------

export const MOCK_MAILBOXES: Mailbox[] = [
	{
		path: "INBOX",
		name: "INBOX",
		delimiter: "/",
		flags: ["\\HasNoChildren"],
		specialUse: "\\Inbox",
		unreadCount: 14,
	},
	{
		path: "Sent",
		name: "Sent",
		delimiter: "/",
		flags: ["\\HasNoChildren", "\\Sent"],
		specialUse: "\\Sent",
		unreadCount: 0,
	},
	{
		path: "Drafts",
		name: "Drafts",
		delimiter: "/",
		flags: ["\\HasNoChildren", "\\Drafts"],
		specialUse: "\\Drafts",
		unreadCount: 2,
	},
	{
		path: "Trash",
		name: "Trash",
		delimiter: "/",
		flags: ["\\HasNoChildren", "\\Trash"],
		specialUse: "\\Trash",
		unreadCount: 0,
	},
	{
		path: "Spam",
		name: "Spam",
		delimiter: "/",
		flags: ["\\HasNoChildren", "\\Junk"],
		specialUse: "\\Junk",
		unreadCount: 5,
	},
	{
		path: "Archive",
		name: "Archive",
		delimiter: "/",
		flags: ["\\HasNoChildren", "\\Archive"],
		specialUse: "\\Archive",
		unreadCount: 0,
	},
	{
		path: "Work",
		name: "Work",
		delimiter: "/",
		flags: ["\\HasNoChildren"],
		unreadCount: 3,
	},
	{
		path: "Newsletters",
		name: "Newsletters",
		delimiter: "/",
		flags: ["\\HasNoChildren"],
		unreadCount: 8,
	},
];

// ---------------------------------------------------------------------------
// Emails  (200 per mailbox — paginated by the handler)
// ---------------------------------------------------------------------------

const EMAIL_COUNT = 200;

function generateEmails(_mailboxPath: string, count: number): Email[] {
	return Array.from({ length: count }, (_, i) => {
		const uid = i + 1;
		const seen = faker.datatype.boolean({ probability: 0.7 });
		const flagged = faker.datatype.boolean({ probability: 0.1 });
		const date = faker.date
			.between({ from: "2024-01-01", to: "2025-12-31" })
			.toISOString();

		return {
			uid,
			subject: faker.lorem.sentence({ min: 3, max: 10 }).replace(/\.$/, ""),
			from: faker.internet.email({
				firstName: faker.person.firstName(),
				lastName: faker.person.lastName(),
			}),
			date,
			seen,
			flagged,
		};
	});
}

// Pre-generate emails for every mailbox so pagination is deterministic.
const emailsByMailbox = new Map<string, Email[]>(
	MOCK_MAILBOXES.map((mb) => [mb.path, generateEmails(mb.path, EMAIL_COUNT)]),
);

export function getEmailsForMailbox(mailboxPath: string): Email[] {
	return emailsByMailbox.get(mailboxPath) ?? [];
}

// ---------------------------------------------------------------------------
// Email details
// ---------------------------------------------------------------------------

export function generateEmailDetail(
	mailboxPath: string,
	uid: number,
): EmailDetail | null {
	const emails = getEmailsForMailbox(mailboxPath);
	const email = emails.find((e) => e.uid === uid);
	if (!email) {
		return null;
	}

	const paragraphs = faker.lorem.paragraphs(
		faker.number.int({ min: 2, max: 6 }),
		"\n\n",
	);

	return {
		uid: email.uid,
		subject: email.subject,
		from: email.from,
		date: email.date,
		seen: email.seen,
		flagged: email.flagged,
		htmlBody: `<html><body><p>${paragraphs.replace(/\n\n/g, "</p><p>")}</p></body></html>`,
		textBody: paragraphs,
	};
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const MOCK_ACTIONS: PersistedAction[] = [
	{
		id: "action-1",
		action: "MOVE",
		createdAt: "2025-03-01T10:00:00.000Z",
		data: {
			accountId: "mock-account",
			uid: 12,
			authorEmail: "alice@example.com",
			fromMailboxPath: "INBOX",
			toMailboxPath: "Archive",
		},
	},
	{
		id: "action-2",
		action: "DELETE",
		createdAt: "2025-03-05T14:30:00.000Z",
		data: {
			accountId: "mock-account",
			uid: 7,
			authorEmail: "bob@example.com",
			mailboxPath: "Newsletters",
		},
	},
	{
		id: "action-3",
		action: "MOVE",
		createdAt: "2025-03-10T09:15:00.000Z",
		data: {
			accountId: "mock-account",
			uid: 55,
			authorEmail: "carol@example.com",
			fromMailboxPath: "Spam",
			toMailboxPath: "INBOX",
		},
	},
	{
		id: "action-4",
		action: "DELETE",
		createdAt: "2025-03-12T16:45:00.000Z",
		data: {
			accountId: "mock-account",
			uid: 33,
			authorEmail: "dave@example.com",
			mailboxPath: "INBOX",
		},
	},
];
