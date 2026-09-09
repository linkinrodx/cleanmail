import type {
	BeginOAuthParams,
	BeginOAuthResult,
	FetchEmailsData,
	PersistedAction,
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
