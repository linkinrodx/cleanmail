import { createHash, randomBytes } from "node:crypto";
import keytar from "keytar";
import type {
	Account,
	AccountProvider,
	OAuthTokens,
} from "../shared/rpc-types";
import { debugLog } from "./debug";
import { rpc } from "./rpc";
import { getAccountById, writeAccounts } from "./storage";

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

// ---------------------------------------------------------------------------
// OAuth callback page rendering.
//
// The callback server replies in the user's SYSTEM browser, so this has to be
// one self-contained document: inline <style>, no bundler, no React, no
// <script> (all motion is CSS keyframes). Every interpolated value goes
// through escapeHtml() — provider error strings and emails are untrusted.
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function providerLabel(provider: AccountProvider): string {
	if (provider === "gmail") {
		return "Gmail";
	}
	if (provider === "outlook") {
		return "Microsoft";
	}
	return provider;
}

type CallbackPageKind = "success" | "error";

function renderCallbackPage(opts: {
	kind: CallbackPageKind;
	title: string;
	message: string;
	/** success: the account email · error: the raw provider / error detail */
	detail?: string;
	/** success only: trailing provenance chip, e.g. "via Gmail" */
	chip?: string;
}): string {
	const { kind, title, message, detail, chip } = opts;
	const isSuccess = kind === "success";

	const icon = isSuccess
		? `<svg class="icon" viewBox="0 0 48 48" aria-hidden="true">
      <circle class="ring" cx="24" cy="24" r="21"></circle>
      <path class="tick" d="M15.5 24.9 21 30.4 32.5 18.9"></path>
    </svg>`
		: `<svg class="icon" viewBox="0 0 48 48" aria-hidden="true">
      <circle class="ring" cx="24" cy="24" r="21"></circle>
      <path class="tick bang" d="M24 14.5v12.6"></path>
      <circle class="dot" cx="24" cy="33.4" r="1.6"></circle>
    </svg>`;

	const role = isSuccess ? "status" : "alert";

	const detailHtml = detail
		? isSuccess
			? `<p class="email"><span class="label">Signed in as</span><span class="email-value">${escapeHtml(detail)}</span></p>`
			: `<pre class="detail"><code>${escapeHtml(detail)}</code></pre>`
		: "";

	const chipHtml =
		isSuccess && chip ? `<p class="chip">${escapeHtml(chip)}</p>` : "";

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<title>${escapeHtml(title)} · CleanMail</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" />
<style>
:root {
  --bg: #f4f5f7; --card: #ffffff; --hair: rgba(255, 255, 255, 0.85); --border: rgba(15, 23, 42, 0.08);
  --text: #111318; --muted: #6a7282; --code: #f3f5f7; --grain: 0.035;
  --stroke: #22c55e; --soft: rgba(34, 197, 94, 0.10);
  --glow-1: rgba(34, 197, 94, 0.13); --glow-2: rgba(56, 189, 248, 0.09);
  --shadow: 0 1px 2px rgba(17,19,24,.05), 0 12px 24px -12px rgba(17,19,24,.18), 0 40px 60px -40px rgba(17,19,24,.25);
}
.kind-error {
  --stroke: #f59e0b; --soft: rgba(245, 158, 11, 0.13);
  --glow-1: rgba(245, 158, 11, 0.12); --glow-2: rgba(244, 63, 94, 0.06);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0a0b0d; --card: #141619; --hair: rgba(255, 255, 255, 0.10); --border: rgba(255, 255, 255, 0.09);
    --text: #eef0f3; --muted: #98a1ae; --code: #1b1e23; --grain: 0.05;
    --stroke: #4ade80; --soft: rgba(74, 222, 128, 0.14);
    --glow-1: rgba(74, 222, 128, 0.10); --glow-2: rgba(56, 189, 248, 0.07);
    --shadow: 0 1px 2px rgba(0,0,0,.45), 0 28px 60px -30px rgba(0,0,0,.9);
  }
  .kind-error {
    --stroke: #fbbf24; --soft: rgba(251, 191, 36, 0.15);
    --glow-1: rgba(251, 191, 36, 0.10); --glow-2: rgba(244, 63, 94, 0.06);
  }
}
* { box-sizing: border-box; }
html { background: var(--bg); }
body {
  margin: 0; min-height: 100vh; min-height: 100dvh; display: grid; place-items: center;
  padding: 2.5rem 1.25rem; color: var(--text); -webkit-font-smoothing: antialiased;
  background: radial-gradient(48rem 32rem at 50% -12%, var(--glow-1), transparent 68%),
    radial-gradient(36rem 26rem at 92% 108%, var(--glow-2), transparent 70%), var(--bg);
  font-family: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
/* Grain overlay — the only texture between the card and the gradient. */
body::before {
  content: ""; position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: var(--grain);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");
}
.card {
  position: relative; z-index: 1; width: 100%; max-width: 26rem; overflow: hidden;
  padding: 2.4rem 2.1rem 2.2rem; text-align: center; background: var(--card);
  border: 1px solid var(--border); border-radius: 1.15rem; box-shadow: var(--shadow);
  animation: card-in 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.card::after {
  content: ""; position: absolute; inset: 0 0 auto 0; height: 1px;
  background: linear-gradient(90deg, transparent, var(--hair), transparent);
}
.brand {
  display: flex; align-items: center; justify-content: center; gap: 0.45rem; margin: 0 0 1.9rem;
  font-size: 0.6875rem; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--muted); animation: fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.04s both;
}
.mark {
  display: block; width: 0.4375rem; height: 0.4375rem; border-radius: 999px;
  background: var(--stroke); box-shadow: 0 0 0 0.25rem var(--soft);
}
.badge {
  display: grid; place-items: center; width: 4.375rem; height: 4.375rem; margin: 0 auto 1.4rem;
  border-radius: 999px; background: var(--soft);
  animation: pop 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.kind-error .badge { animation: pop 0.55s cubic-bezier(0.16, 1, 0.3, 1) both, shake 0.5s ease-in-out 0.6s; }
.icon { width: 2.375rem; height: 2.375rem; overflow: visible; }
.ring {
  fill: none; stroke: var(--stroke); stroke-width: 1.6; stroke-dasharray: 132; stroke-dashoffset: 132;
  animation: draw 0.75s cubic-bezier(0.65, 0, 0.35, 1) 0.12s forwards;
}
.tick {
  fill: none; stroke: var(--stroke); stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round;
  stroke-dasharray: 27; stroke-dashoffset: 27;
  animation: draw 0.45s cubic-bezier(0.65, 0, 0.35, 1) 0.62s forwards;
}
.bang { stroke-dasharray: 13; stroke-dashoffset: 13; }
.dot { fill: var(--stroke); opacity: 0; animation: fade 0.35s ease-out 0.95s forwards; }
h1 {
  margin: 0 0 0.55rem; font-size: 1.4375rem; font-weight: 600; letter-spacing: -0.021em; line-height: 1.25;
  animation: fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
}
.msg {
  margin: 0 auto; max-width: 21rem; font-size: 0.9375rem; line-height: 1.62; color: var(--muted);
  animation: fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.28s both;
}
.email { margin: 1.6rem 0 0; animation: fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.38s both; }
.label, .chip { font-size: 0.6875rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.label { display: block; margin: 0 0 0.5rem; }
.email-value {
  display: inline-block; padding: 0.5rem 0.95rem; background: var(--code); color: var(--text);
  border: 1px solid var(--border); border-radius: 999px; font-size: 0.875rem; font-weight: 500;
  word-break: break-all; font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.chip {
  display: inline-flex; align-items: center; gap: 0.4rem; margin: 1.05rem 0 0; padding: 0.25rem 0.65rem;
  border: 1px solid var(--border); border-radius: 999px;
  animation: fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.46s both;
}
.chip::before {
  content: ""; width: 0.3125rem; height: 0.3125rem; border-radius: 999px; background: var(--stroke);
}
.detail {
  margin: 1.5rem 0 0; padding: 0.8rem 0.9rem; max-height: 9rem; overflow: auto;
  background: var(--code); color: var(--muted); text-align: left;
  border: 1px solid var(--border); border-radius: 0.65rem; font-size: 0.75rem; line-height: 1.6;
  white-space: pre-wrap; word-break: break-word;
  font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  animation: fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.38s both;
}
@keyframes card-in { from { opacity: 0; transform: translateY(14px) scale(0.985); } to { opacity: 1; transform: none; } }
@keyframes fade-up { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }
@keyframes pop { from { opacity: 0; transform: scale(0.86); } to { opacity: 1; transform: none; } }
@keyframes fade { to { opacity: 1; } }
@keyframes draw { to { stroke-dashoffset: 0; } }
@keyframes shake {
  0%, 100% { transform: translateX(0); } 20% { transform: translateX(-3px); } 40% { transform: translateX(3px); }
  60% { transform: translateX(-2px); } 80% { transform: translateX(2px); }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.001s !important; animation-delay: 0s !important; }
  .ring, .tick { stroke-dashoffset: 0; }
  .dot { opacity: 1; }
}
</style>
</head>
<body class="kind-${kind}">
<main class="card" role="${role}">
  <p class="brand"><span class="mark"></span>CleanMail</p>
  <span class="badge">${icon}</span>
  <h1>${escapeHtml(title)}</h1>
  <p class="msg">${escapeHtml(message)}</p>
  ${detailHtml}
  ${chipHtml}
</main>
</body>
</html>
`;
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
		refresh_token?: string;
		expires_in: number;
		id_token?: string;
	};
	try {
		data = JSON.parse(safeBody) as typeof data;
	} catch {
		debugLog(`[oauth] tokenExchange invalid JSON: ${safeBody}`);
		throw new Error(`Token exchange returned non-JSON body: ${safeBody}`);
	}

	// Google legitimately omits refresh_token when the account has already
	// consented (no `prompt=consent` re-prompt) or when scope approval was
	// denied. Without it the account can never re-authenticate, so fail loudly
	// here instead of storing an undefined token in the keychain.
	if (!data.refresh_token) {
		debugLog(
			`[oauth] tokenExchange MISSING refresh_token provider=${provider} accessTokenPresent=${!!data.access_token} expiresIn=${data.expires_in}`,
		);
		throw new Error(
			"The provider did not return a refresh token. Re-run the sign-in and approve the consent screen (Error 403 / access_denied or already-consented accounts can cause this).",
		);
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

// Start periodic cleanup (every 5 minutes). Unref the timer so this module-level
// interval never keeps the event loop (and thus the process) alive on its own.
const pendingStateCleanupTimer = setInterval(
	cleanupPendingStates,
	5 * 60 * 1000,
);
pendingStateCleanupTimer.unref();

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

					const who = pending
						? providerLabel(pending.provider)
						: "The provider";
					return new Response(
						renderCallbackPage({
							kind: "error",
							title: "Sign-in failed.",
							message: `${who} reported an error while authorizing CleanMail. Nothing was saved, so you can try again.`,
							detail: error,
						}),
						{ headers: { "Content-Type": "text/html" } },
					);
				}

				if (!code || !state) {
					return new Response(
						renderCallbackPage({
							kind: "error",
							title: "Sign-in failed.",
							message:
								"The sign-in link is incomplete. Please start the connection again from CleanMail.",
							detail:
								"The callback URL arrived without a code or state parameter.",
						}),
						{ headers: { "Content-Type": "text/html" }, status: 400 },
					);
				}

				const pending = pendingStates.get(state);
				if (!pending) {
					return new Response(
						renderCallbackPage({
							kind: "error",
							title: "Sign-in failed.",
							message:
								"This sign-in request was already used or has expired. Please start the connection again from CleanMail.",
							detail:
								"State not found — the callback did not match a pending sign-in.",
						}),
						{ headers: { "Content-Type": "text/html" }, status: 400 },
					);
				}

				pendingStates.delete(state);

				try {
					const account = await completeAuthorization(
						pending.provider,
						code,
						pending.codeVerifier,
					);

					const result = { account };
					pending.resolve(result);
					rpc.send.oauthComplete(result);

					// Stop server after successful completion
					callbackServerStarted = false;
					server?.stop();

					return new Response(
						renderCallbackPage({
							kind: "success",
							title: "Connected.",
							message:
								"CleanMail can now sync your mailbox. You can close this tab and return to the app.",
							detail: account.email,
							chip: `via ${providerLabel(pending.provider)}`,
						}),
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
						renderCallbackPage({
							kind: "error",
							title: "Sign-in failed.",
							message: `CleanMail could not finish connecting to ${providerLabel(pending.provider)}. No account was saved.`,
							detail: errorMsg,
						}),
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
		// await, not return: readAccounts() is async and a returned (un-awaited)
		// rejection would bypass this try/catch entirely.
		return await readAccounts();
	} catch {
		return [];
	}
}

// Shared completion pipeline for BOTH the callback server and the manual
// (paste-the-URL) flow: exchange the code, resolve the account email, persist
// the account (keytar refresh token + storage append) and log success.
// Throws a descriptive Error on any failed step; the callers decide how to
// surface it (HTTP page + pending promise, or RPC result).
async function completeAuthorization(
	provider: AccountProvider,
	code: string,
	codeVerifier: string,
): Promise<Account> {
	const tokens = await exchangeCodeForTokens(provider, code, codeVerifier);

	let email = "";
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
		// Prefer the id_token from the initial token exchange (no second exchange!)
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
		}
		if (!email) {
			// Fallback (no id_token, decode failure, or no email claim): Microsoft Graph.
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

	debugLog(
		`[oauth] SUCCESS provider=${provider} email=${email} accountId=${account.id}`,
	);

	return account;
}

async function finalizeOAuth(
	provider: AccountProvider,
	code: string,
	codeVerifier: string,
): Promise<
	{ success: true; account: Account } | { success: false; error: string }
> {
	try {
		const account = await completeAuthorization(provider, code, codeVerifier);
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
		const envVar = provider === "gmail" ? "GOOGLE_CLIENT_ID" : "MS_CLIENT_ID";
		const envState = Bun.env[envVar] ? "set" : "EMPTY";
		debugLog(
			`[oauth] beginOAuthFlow ABORTED: ${provider} client ID empty (${envVar} is ${envState} — check your .env and restart the app)`,
		);
		return {
			success: false,
			error: `${provider} client ID not configured (${envVar} is ${envState} — check your .env and restart the app)`,
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
