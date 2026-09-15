import type {
	BeginOAuthParams,
	BeginOAuthResult,
	FetchEmailsData,
	PersistedAction,
	SenderGroup,
} from "../../shared/rpc-types";
import {
	generateEmailDetail,
	getEmailsForMailbox,
	MOCK_ACTIONS,
	MOCK_MAILBOXES,
} from "./data";

const SIMULATED_DELAY_MS = 300;

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mockFetchEmails(params: FetchEmailsData) {
	await delay(SIMULATED_DELAY_MS);

	// accountId is accepted for signature compatibility but ignored in mock mode
	const { mailboxPath, page = 1, itemsPerPage = 20, from } = params;

	let emails = getEmailsForMailbox(mailboxPath);

	if (from) {
		const needle = from.toLowerCase();
		emails = emails.filter((e) => e.from.toLowerCase().includes(needle));
	}

	const total = emails.length;
	const start = (page - 1) * itemsPerPage;
	const paged = emails.slice(start, start + itemsPerPage);

	return { emails: paged, total };
}

export async function mockFetchEmailDetail(params: {
	accountId: string;
	mailboxPath: string;
	uid: number;
}) {
	await delay(SIMULATED_DELAY_MS);

	const email = generateEmailDetail(params.mailboxPath, params.uid);
	return { email };
}

export async function mockFetchMailboxes(_params: { accountId: string }) {
	await delay(SIMULATED_DELAY_MS);
	return { mailboxes: MOCK_MAILBOXES };
}

export async function mockGetActions(_params: { accountId?: string }) {
	await delay(SIMULATED_DELAY_MS);
	return { actions: MOCK_ACTIONS as PersistedAction[] };
}

export async function mockBeginOAuth(
	_params: BeginOAuthParams,
): Promise<BeginOAuthResult> {
	await delay(SIMULATED_DELAY_MS);
	return { state: "mock", authUrl: "" };
}

export async function mockCompleteOAuth() {
	await delay(SIMULATED_DELAY_MS);
	return { success: true };
}

export async function mockGroupEmails(_params: {
	accountId: string;
	mailboxPath: string;
}): Promise<{ groups: SenderGroup[]; status: "ready"; cachedAt: null }> {
	await delay(SIMULATED_DELAY_MS);
	return {
		groups: [
			{
				authorEmail: "news@uber.com",
				count: 1000,
				lastDate: new Date().toISOString(),
				sampleSubjects: ["Your trip receipt", "Welcome to Uber"],
				recommendedAction: "ARCHIVE",
			},
			{
				authorEmail: "no-reply@pinterest.com",
				count: 500,
				lastDate: new Date().toISOString(),
				sampleSubjects: ["Pins for you", "New ideas"],
				recommendedAction: "TRASH",
			},
			{
				authorEmail: "newsletter@aliexpress.com",
				count: 750,
				lastDate: new Date().toISOString(),
				sampleSubjects: ["Deals of the day", "Flash sale"],
				recommendedAction: "ARCHIVE",
			},
			{
				authorEmail: "digest@linkedin.com",
				count: 300,
				lastDate: new Date().toISOString(),
				sampleSubjects: ["Weekly digest", "People you may know"],
				recommendedAction: "MARK_READ",
			},
		],
		status: "ready",
		cachedAt: null,
	};
}

export async function mockFetchSenderEmails(params: {
	accountId: string;
	mailboxPath: string;
	authorEmail: string;
	page?: number;
	itemsPerPage?: number;
}) {
	await delay(SIMULATED_DELAY_MS);
	const { mailboxPath, authorEmail, page = 1, itemsPerPage = 20 } = params;
	// Match production semantics: EXACT sender address (not substring).
	const target = authorEmail.toLowerCase();
	const all = getEmailsForMailbox(mailboxPath).filter(
		(e) => e.from.toLowerCase() === target,
	);
	const total = all.length;
	const start = (page - 1) * itemsPerPage;
	return { emails: all.slice(start, start + itemsPerPage), total };
}
