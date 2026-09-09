import keytar from "keytar";
import type {
	Account,
	AddAccountPasswordParams,
	BeginOAuthParams,
	BeginOAuthResult,
	CompleteOAuthParams,
} from "../shared/rpc-types";
import { readAccounts, writeAccounts, getAccountById } from "./storage";
import { beginOAuthFlow, completeOAuthManually } from "./oauth";

const KEYTAR_SERVICE = "cleanmail";
const KEYTAR_ACCOUNT_PASSWORD = (accountId: string) =>
	`cleanmail:acct:${accountId}:password`;
const KEYTAR_ACCOUNT_OAUTH = (accountId: string) =>
	`cleanmail:acct:${accountId}:oauth`;

export async function rpcListAccounts() {
	try {
		const accounts = await readAccounts();
		return { accounts };
	} catch (err) {
		return {
			accounts: [],
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

export async function rpcGetAccount({ id }: { id: string }) {
	try {
		const account = await getAccountById(id);
		return account;
	} catch {
		return null;
	}
}

export async function rpcAddAccountPassword({
	provider,
	email,
	host,
	port,
	password,
}: AddAccountPasswordParams) {
	try {
		const account: Account = {
			id: crypto.randomUUID(),
			provider,
			email,
			host,
			port,
			authMethod: "password",
		};

		await keytar.setPassword(
			KEYTAR_SERVICE,
			KEYTAR_ACCOUNT_PASSWORD(account.id),
			password,
		);
		await writeAccounts([...(await readAccounts()), account]);

		return { success: true, account };
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

export async function rpcBeginOAuth({
	provider,
}: BeginOAuthParams): Promise<BeginOAuthResult> {
	const result = await beginOAuthFlow(provider);
	if (!result.success) {
		return {
			state: "",
			authUrl: "",
			error: result.error,
		};
	}
	return { state: result.state, authUrl: result.authUrl };
}

export async function rpcCompleteOAuth({
	state,
	code,
	provider,
}: CompleteOAuthParams) {
	try {
		const result = await completeOAuthManually(state, code, provider);
		return result;
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

export async function rpcRemoveAccount({ id }: { id: string }) {
	try {
		const accounts = await readAccounts();
		const filtered = accounts.filter((a) => a.id !== id);
		await writeAccounts(filtered);

		await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_PASSWORD(id));
		await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_OAUTH(id));

		return { success: true };
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}
