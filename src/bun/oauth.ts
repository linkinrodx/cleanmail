import { createHash, randomBytes } from "node:crypto";
import keytar from "keytar";
import type {
	Account,
	AccountProvider,
	OAuthTokens,
} from "../shared/rpc-types";
import { getAccountById, writeAccounts } from "./storage";
import { rpc } from "./rpc";
import { debugLog } from "./debug";

const KEYTAR_SERVICE = "cleanmail";
const KEYTAR_ACCOUNT_OAUTH = (accountId: string) =>
	`cleanmail:acct:${accountId}:oauth`;

const DEFAULT_PORT = 8765;
const DEFAULT_PATH = "/callback";

const getPort = (): number => {
	const port = Bun.env.OAUTH_CALLBACK_PORT;
	return port ? Number(port) : DEFAULT_PORT;
};

const getPath = (): string => {
	return Bun.env.OAUTH_CALLBACK_PATH ?? DEFAULT_PATH;
};

const getRedirectUri = (): string => {
	return `http://localhost:${getPort()}${getPath()}`;
};

const getGoogleConfig = () => ({
	clientId: Bun.env.GOOGLE_CLIENT_ID ?? "",
	clientSecret: Bun.env.GOOGLE_CLIENT_SECRET ?? "",
	authorizeUrl:
		Bun.env.GOOGLE_AUTHORIZE_URL ??
		"https://accounts.google.com/o/oauth2/v2/auth",
	tokenUrl: Bun.env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token",
	scope:
		Bun.env.GOOGLE_SCOPE ??
		"https://mail.google.com/ https://www.googleapis.com/auth/userinfo.email",
});

const getMicrosoftConfig = () => ({
	clientId: Bun.env.MS_CLIENT_ID ?? "",
	tenant: Bun.env.MS_TENANT ?? "common",
	authorizeUrl:
		Bun.env.MS_AUTHORIZE_URL ??
		"https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
	tokenUrl:
		Bun.env.MS_TOKEN_URL ??
		"https://login.microsoftonline.com/common/oauth2/v2.0/token",
	scope:
		Bun.env.MS_SCOPE ??
		"https://outlook.office365.com/IMAP.AccessAsUser.All offline_access openid email",
});

export function generatePkce(): {
	codeVerifier: string;
	codeChallenge: string;
} {
	const codeVerifier = randomBytes(32).toString("base64url");
	const hash = createHash("sha256").update(codeVerifier).digest();
	const codeChallenge = hash.toString("base64url");
	return { codeVerifier, codeChallenge };
}

// Microsoft id_tokens are base64url-encoded JWTs; decode the payload safely.
function decodeJwtPayload(idToken: string): Record<string, string> {
	const part = idToken.split(".")[1] ?? "";
	const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
	const json = Buffer.from(b64, "base64").toString("utf8");
	return JSON.parse(json) as Record<string, string>;
}

export function buildAuthorizeUrl(
	provider: AccountProvider,
	state: string,
	codeChallenge: string,
): string {
	const redirectUri = getRedirectUri();
	const params = new URLSearchParams({
		response_type: "code",
		client_id: "",
		redirect_uri: redirectUri,
		scope: "",
		state,
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
	});

	if (provider === "gmail") {
		const cfg = getGoogleConfig();
		params.set("client_id", cfg.clientId);
		params.set("scope", cfg.scope);
		params.set("access_type", "offline");
		params.set("prompt", "consent");
		return `${cfg.authorizeUrl}?${params.toString()}`;
	}

	if (provider === "outlook") {
		const cfg = getMicrosoftConfig();
		params.set("client_id", cfg.clientId);
		params.set("scope", cfg.scope);
		return `${cfg.authorizeUrl}?${params.toString()}`;
	}

	throw new Error(`Unsupported provider: ${provider}`);
}

// Microsoft returns gzip-compressed responses that this Bun build fails to decode
// via response.text()/json() ("El fragmento ha recibido datos incorrectos"). Read
// the body defensively so we always see the real error / payload.
async function readBodySafely(response: Response): Promise<string> {
	try {
		return await response.text();
	} catch (e) {
		try {
			const buf = await response.arrayBuffer();
			return new TextDecoder("utf-8").decode(new Uint8Array(buf));
		} catch (e2) {
			return `<unreadable body: ${String(e)} / ${String(e2)}>`;
		}
	}
}

async function exchangeCodeForTokens(
	provider: AccountProvider,
	code: string,
	codeVerifier: string,
): Promise<OAuthTokens & { idToken?: string }> {
	const redirectUri = getRedirectUri();
	const body = new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: redirectUri,
		code_verifier: codeVerifier,
	});

	let tokenUrl: string;
	let clientId: string;

	if (provider === "gmail") {
		const cfg = getGoogleConfig();
		tokenUrl = cfg.tokenUrl;
		clientId = cfg.clientId;
		body.set("client_id", clientId);
		if (cfg.clientSecret) {
			body.set("client_secret", cfg.clientSecret);
		}
	} else if (provider === "outlook") {
		const cfg = getMicrosoftConfig();
		tokenUrl = cfg.tokenUrl;
		clientId = cfg.clientId;
		body.set("client_id", clientId);
	} else {
		throw new Error(`Unsupported provider: ${provider}`);
	}

	const response = await fetch(tokenUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"Accept-Encoding": "identity",
		},
		body: body.toString(),
	});

	const safeBody = await readBodySafely(response);
	if (!response.ok) {
		debugLog(
			`[oauth] tokenExchange FAILED provider=${provider} status=${response.status} clientIdSet=${!!clientId} content-type=${response.headers.get("content-type")} bodySent=${body.toString().replace(clientId, "<CLIENT_ID>")}`,
		);
		debugLog(`[oauth] tokenExchange errorResponse=${safeBody}`);
		throw new Error(`Token exchange failed: ${response.status} ${safeBody}`);
	}

	let data: {
		access_token: string;
		refresh_token: string;
		expires_in: number;
		id_token?: string;
	};
	try {
		data = JSON.parse(safeBody) as typeof data;
	} catch {
		debugLog(`[oauth] tokenExchange invalid JSON: ${safeBody}`);
		throw new Error(`Token exchange returned non-JSON body: ${safeBody}`);
	}

	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		expiresAt: Date.now() + data.expires_in * 1000,
		idToken: data.id_token,
	};
}

export async function refreshAccessToken(
	provider: AccountProvider,
	refreshToken: string,
): Promise<OAuthTokens> {
	const body = new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: refreshToken,
	});

	let tokenUrl: string;
	let clientId: string;

	if (provider === "gmail") {
		const cfg = getGoogleConfig();
		tokenUrl = cfg.tokenUrl;
		clientId = cfg.clientId;
		body.set("client_id", clientId);
		if (cfg.clientSecret) {
			body.set("client_secret", cfg.clientSecret);
		}
	} else if (provider === "outlook") {
		const cfg = getMicrosoftConfig();
		tokenUrl = cfg.tokenUrl;
		clientId = cfg.clientId;
		body.set("client_id", clientId);
	} else {
		throw new Error(`Unsupported provider: ${provider}`);
	}

	const response = await fetch(tokenUrl, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: body.toString(),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Token refresh failed: ${response.status} ${text}`);
	}

	const data = (await response.json()) as {
		access_token: string;
		refresh_token?: string;
		expires_in: number;
	};

	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token ?? refreshToken,
		expiresAt: Date.now() + data.expires_in * 1000,
	};
}

export async function getValidAccessToken(accountId: string): Promise<string> {
	const stored = await keytar.getPassword(
		KEYTAR_SERVICE,
		KEYTAR_ACCOUNT_OAUTH(accountId),
	);
	if (!stored) {
		throw new Error("OAuth tokens not found for account");
	}

	const parsed = JSON.parse(stored) as {
		refreshToken?: string;
		accessToken?: string;
		expiresAt?: number;
	};
	const refreshToken = parsed.refreshToken;
	if (!refreshToken) {
		throw new Error("OAuth refresh token missing for account");
	}

	// We only persist the refresh token (Credential Manager blob size limit), so a
	// fresh access token is always fetched on demand.
	const account = await getAccountById(accountId);
	if (!account) {
		throw new Error("Account not found");
	}
	const newTokens = await refreshAccessToken(account.provider, refreshToken);
	await keytar.setPassword(
		KEYTAR_SERVICE,
		KEYTAR_ACCOUNT_OAUTH(accountId),
		JSON.stringify({ refreshToken: newTokens.refreshToken }),
	);
	return newTokens.accessToken;
}

export function openBrowser(url: string): void {
	const platform = process.platform;
	let command: string[];
	if (platform === "darwin") {
		command = ["open", url];
	} else if (platform === "win32") {
		// Spawn rundll32 directly so the URL reaches the browser verbatim.
		// Using `cmd /c start` would re-parse the command line and mangle the
		// & (command separator) and % (variable expansion) characters present in
		// the authorize URL. Mac/Linux receive the URL directly as argv.
		command = ["rundll32", "url.dll,FileProtocolHandler", url];
	} else {
		command = ["xdg-open", url];
	}

	try {
		Bun.spawn(command, { stdio: ["ignore", "ignore", "ignore"] });
	} catch {
		// Ignore errors — user can manually open the URL
	}
}

type PendingState = {
	codeVerifier: string;
	resolve: (
		value: { account: Account } | { error: string; provider?: AccountProvider },
	) => void;
	provider: AccountProvider;
	createdAt: number;
};

const pendingStates = new Map<string, PendingState>();
let callbackServerStarted = false;

function cleanupPendingStates(): void {
	const now = Date.now();
	const maxAge = 10 * 60 * 1000; // 10 minutes
	for (const [state, pending] of pendingStates.entries()) {
		if (now - pending.createdAt > maxAge) {
			pendingStates.delete(state);
		}
	}
}

// Start periodic cleanup (every 5 minutes)
setInterval(cleanupPendingStates, 5 * 60 * 1000);

function startCallbackServer(): void {
	if (callbackServerStarted) {
		return;
	}
	callbackServerStarted = true;

	const port = getPort();
	const path = getPath();

	let server: ReturnType<typeof Bun.serve> | null = null;
	try {
		server = Bun.serve({
			port,
			hostname: "localhost",
			async fetch(req) {
				const url = new URL(req.url);
				if (url.pathname !== path) {
					return new Response("Not found", { status: 404 });
				}

				const code = url.searchParams.get("code");
				const state = url.searchParams.get("state");
				const error = url.searchParams.get("error");

				if (error) {
					debugLog(`[oauth] callback got OAuth error from provider: ${error}`);
					const pending = pendingStates.get(state ?? "");
					if (pending) {
						pending.resolve({ error, provider: pending.provider });
						pendingStates.delete(state ?? "");
					}
					// Stop server after handling error
					callbackServerStarted = false;
					server?.stop();

					return new Response(
						`<html><body><h1>OAuth Error</h1><p>${error}</p></body></html>`,
						{ headers: { "Content-Type": "text/html" } },
					);
				}

				if (!code || !state) {
					return new Response(
						`<html><body><h1>Invalid Callback</h1><p>Missing code or state</p></body></html>`,
						{ headers: { "Content-Type": "text/html" }, status: 400 },
					);
				}

				const pending = pendingStates.get(state);
				if (!pending) {
					return new Response(
						`<html><body><h1>Invalid State</h1><p>State not found or expired</p></body></html>`,
						{ headers: { "Content-Type": "text/html" }, status: 400 },
					);
				}

				pendingStates.delete(state);

				try {
					const tokens = await exchangeCodeForTokens(
						pending.provider,
						code,
						pending.codeVerifier,
					);

					let email: string;
					if (pending.provider === "gmail") {
						const userInfoRes = await fetch(
							"https://www.googleapis.com/oauth2/v3/userinfo",
							{
								headers: { Authorization: `Bearer ${tokens.accessToken}` },
							},
						);
						if (!userInfoRes.ok) {
							throw new Error("Failed to fetch user info from Google");
						}
						const userInfo = (await userInfoRes.json()) as { email: string };
						email = userInfo.email;
					} else if (pending.provider === "outlook") {
						// Use id_token from the initial token exchange (no second exchange!)
						const idToken = tokens.idToken;
						if (idToken) {
							try {
								const payload = decodeJwtPayload(idToken);
								email =
									payload.email ??
									payload.preferred_username ??
									payload.upn ??
									"";
							} catch (e) {
								debugLog(`[oauth] failed to decode id_token: ${String(e)}`);
								email = "";
							}
						} else {
							// Fallback: call Microsoft Graph
							const graphRes = await fetch(
								"https://graph.microsoft.com/v1.0/me",
								{
									headers: { Authorization: `Bearer ${tokens.accessToken}` },
								},
							);
							if (graphRes.ok) {
								const graphData = (await graphRes.json()) as {
									mail?: string;
									userPrincipalName?: string;
								};
								email = graphData.mail ?? graphData.userPrincipalName ?? "";
							} else {
								throw new Error("Failed to fetch user email from Microsoft");
							}
						}
					} else {
						throw new Error(`Unsupported provider: ${pending.provider}`);
					}

					if (!email) {
						throw new Error("Could not determine user email");
					}

					const account: Account = {
						id: crypto.randomUUID(),
						provider: pending.provider,
						email,
						host:
							pending.provider === "gmail"
								? "imap.gmail.com"
								: "outlook.office365.com",
						port: 993,
						authMethod: "oauth2",
					};

					// Store ONLY the refresh token. Windows Credential Manager caps the
					// credential blob at ~2560 bytes, and the full token set (access_token +
					// refresh_token + id_token) exceeds that and throws a localized error.
					// A fresh access_token is fetched on demand via refreshAccessToken().
					await keytar.setPassword(
						KEYTAR_SERVICE,
						KEYTAR_ACCOUNT_OAUTH(account.id),
						JSON.stringify({ refreshToken: tokens.refreshToken }),
					);

					await writeAccounts([...(await readAccountsInternal()), account]);

					const result = { account };
					pending.resolve(result);
					rpc.send.oauthComplete(result);

					// Stop server after successful completion
					callbackServerStarted = false;
					server?.stop();

					return new Response(
						`<html><body><h1>Success!</h1><p>Account ${email} added. You can close this window.</p></body></html>`,
						{ headers: { "Content-Type": "text/html" } },
					);
				} catch (err) {
					const errorMsg = err instanceof Error ? err.message : String(err);
					const cause =
						err instanceof Error && err.cause
							? ` | cause=${JSON.stringify(err.cause)}`
							: "";
					const stack =
						err instanceof Error && err.stack ? ` | stack=${err.stack}` : "";
					debugLog(
						`[oauth] callback ERROR (provider=${pending.provider}): ${errorMsg}${cause}${stack}`,
					);
					pending.resolve({ error: errorMsg, provider: pending.provider });
					rpc.send.oauthComplete({
						error: errorMsg,
						provider: pending.provider,
					});

					// Stop server after error
					callbackServerStarted = false;
					server?.stop();

					return new Response(
						`<html><body><h1>Error</h1><p>${errorMsg}</p></body></html>`,
						{ headers: { "Content-Type": "text/html" }, status: 500 },
					);
				}
			},
		});
		} catch (err) {
		debugLog(
			`[oauth] callback server FAILED to start on port ${port} (already in use by another instance?): ${String(err)}`,
		);
	}

	console.log(
		`OAuth callback server listening on http://localhost:${port}${path}`,
	);
}

async function readAccountsInternal(): Promise<Account[]> {
	try {
		const { readAccounts } = await import("./storage");
		return readAccounts();
	} catch {
		return [];
	}
}

async function finalizeOAuth(
	provider: AccountProvider,
	code: string,
	codeVerifier: string,
): Promise<
	{ success: true; account: Account } | { success: false; error: string }
> {
	try {
		const tokens = await exchangeCodeForTokens(provider, code, codeVerifier);

		let email: string;
		if (provider === "gmail") {
			const userInfoRes = await fetch(
				"https://www.googleapis.com/oauth2/v3/userinfo",
				{
					headers: { Authorization: `Bearer ${tokens.accessToken}` },
				},
			);
			if (!userInfoRes.ok) {
				throw new Error("Failed to fetch user info from Google");
			}
			const userInfo = (await userInfoRes.json()) as { email: string };
			email = userInfo.email;
		} else if (provider === "outlook") {
			// Use id_token from the initial token exchange (no second exchange!)
			const idToken = tokens.idToken;
			if (idToken) {
				try {
					const payload = decodeJwtPayload(idToken);
					email =
						payload.email ?? payload.preferred_username ?? payload.upn ?? "";
				} catch (e) {
					debugLog(`[oauth] failed to decode id_token: ${String(e)}`);
					email = "";
				}
			} else {
				// Fallback: call Microsoft Graph
				const graphRes = await fetch("https://graph.microsoft.com/v1.0/me", {
					headers: {
						Authorization: `Bearer ${tokens.accessToken}`,
						"Accept-Encoding": "identity",
					},
				});
				if (graphRes.ok) {
					const graphBody = await readBodySafely(graphRes);
					try {
						const graphData = JSON.parse(graphBody) as {
							mail?: string;
							userPrincipalName?: string;
						};
						email = graphData.mail ?? graphData.userPrincipalName ?? "";
					} catch {
						email = "";
					}
				} else {
					const graphErr = await readBodySafely(graphRes);
					debugLog(
						`[oauth] graph FAILED status=${graphRes.status} body=${graphErr}`,
					);
					throw new Error("Failed to fetch user email from Microsoft");
				}
			}
		} else {
			throw new Error(`Unsupported provider: ${provider}`);
		}

		if (!email) {
			throw new Error("Could not determine user email");
		}

		const account: Account = {
			id: crypto.randomUUID(),
			provider,
			email,
			host: provider === "gmail" ? "imap.gmail.com" : "outlook.office365.com",
			port: 993,
			authMethod: "oauth2",
		};

		await keytar.setPassword(
			KEYTAR_SERVICE,
			KEYTAR_ACCOUNT_OAUTH(account.id),
			JSON.stringify({ refreshToken: tokens.refreshToken }),
		);

		await writeAccounts([...(await readAccountsInternal()), account]);

		rpc.send.oauthComplete({ account });

		return { success: true, account };
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : String(err);
		rpc.send.oauthComplete({ error: errorMsg, provider });
		return { success: false, error: errorMsg };
	}
}

export async function beginOAuthFlow(
	provider: AccountProvider,
): Promise<
	| { success: true; state: string; authUrl: string }
	| { success: false; error: string }
> {
	// Validate client ID before starting
	const cfg = provider === "gmail" ? getGoogleConfig() : getMicrosoftConfig();
	if (!cfg.clientId) {
		debugLog(
			`[oauth] beginOAuthFlow ABORTED: ${provider} client ID empty (MS_CLIENT_ID set=${!!Bun.env.MS_CLIENT_ID}, GOOGLE_CLIENT_ID set=${!!Bun.env.GOOGLE_CLIENT_ID})`,
		);
		return {
			success: false,
			error: `${provider} client ID not configured (MS_CLIENT_ID is ${Bun.env.MS_CLIENT_ID ? "set" : "EMPTY"} — check your .env and restart the app)`,
		};
	}

	startCallbackServer();

	const state = crypto.randomUUID();
	const { codeVerifier, codeChallenge } = generatePkce();
	const authUrl = buildAuthorizeUrl(provider, state, codeChallenge);

	pendingStates.set(state, {
		codeVerifier,
		resolve: () => {},
		provider,
		createdAt: Date.now(),
	});

	openBrowser(authUrl);

	return { success: true, state, authUrl };
}

export async function completeOAuthManually(
	state: string,
	code: string,
	provider: AccountProvider,
): Promise<{ success: boolean; account?: Account; error?: string }> {
	const pending = pendingStates.get(state);
	if (!pending) {
		return { success: false, error: "Invalid or expired state" };
	}

	if (pending.provider !== provider) {
		return { success: false, error: "Provider mismatch" };
	}

	pendingStates.delete(state);

	return finalizeOAuth(provider, code, pending.codeVerifier);
}
