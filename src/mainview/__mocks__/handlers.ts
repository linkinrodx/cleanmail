import type { FetchEmailsData, PersistedAction } from "../../shared/rpc-types";
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
	mailboxPath: string;
	uid: number;
}) {
	await delay(SIMULATED_DELAY_MS);

	const email = generateEmailDetail(params.mailboxPath, params.uid);
	return { email };
}

export async function mockFetchMailboxes() {
	await delay(SIMULATED_DELAY_MS);
	return { mailboxes: MOCK_MAILBOXES };
}

export async function mockGetActions() {
	await delay(SIMULATED_DELAY_MS);
	return { actions: MOCK_ACTIONS as PersistedAction[] };
}
