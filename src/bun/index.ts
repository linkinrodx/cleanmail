import { BrowserView, BrowserWindow, Updater } from "electrobun/bun";
import { ImapFlow } from "imapflow";
import keytar from "keytar";
import type { CleanMailRPC, Email } from "../shared/rpc-types";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;
const KEYTAR_SERVICE = "cleanmail";
const KEYTAR_ACCOUNT_CONFIG = "imap-config";
const KEYTAR_ACCOUNT_PASSWORD = "imap-password";

async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch (e) {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
			throw e;
		}
	}
	return "views://mainview/index.html";
}

const rpc = BrowserView.defineRPC<CleanMailRPC>({
	handlers: {
		requests: {
			getImapConfig: async () => {
				const configJson = await keytar.getPassword(
					KEYTAR_SERVICE,
					KEYTAR_ACCOUNT_CONFIG,
				);
				if (!configJson) return null;
				try {
					return JSON.parse(configJson) as {
						host: string;
						port: number;
						username: string;
					};
				} catch {
					return null;
				}
			},

			saveImapConfig: async ({ host, port, username, password }) => {
				try {
					await keytar.setPassword(
						KEYTAR_SERVICE,
						KEYTAR_ACCOUNT_CONFIG,
						JSON.stringify({ host, port, username }),
					);
					await keytar.setPassword(
						KEYTAR_SERVICE,
						KEYTAR_ACCOUNT_PASSWORD,
						password,
					);
					return { success: true };
				} catch (err) {
					return {
						success: false,
						error: err instanceof Error ? err.message : String(err),
					};
				}
			},

			fetchEmails: async () => {
				const configJson = await keytar.getPassword(
					KEYTAR_SERVICE,
					KEYTAR_ACCOUNT_CONFIG,
				);
				const password = await keytar.getPassword(
					KEYTAR_SERVICE,
					KEYTAR_ACCOUNT_PASSWORD,
				);

				if (!configJson || !password) {
					return { emails: [], error: "IMAP not configured" };
				}

				let config: { host: string; port: number; username: string };
				try {
					config = JSON.parse(configJson);
				} catch {
					return { emails: [], error: "Invalid IMAP config" };
				}

				const client = new ImapFlow({
					host: config.host,
					port: config.port,
					secure: config.port === 993,
					auth: {
						user: config.username,
						pass: password,
					},
					logger: false,
				});

				try {
					await client.connect();

					const lock = await client.getMailboxLock("INBOX");
					const emails: Email[] = [];

					try {
						const messages = [];
						for await (const message of client.fetch(
							{ seq: "*:*" },
							{
								uid: true,
								envelope: true,
								flags: true,
							},
							{ uid: false },
						)) {
							messages.push(message);
						}

						// Take last 20
						const recent = messages.slice(-20).reverse();

						for (const msg of recent) {
							const envelope = msg.envelope;
							if (!envelope) continue;

							const fromAddress = envelope.from?.[0];
							const fromStr = fromAddress
								? fromAddress.name
									? `${fromAddress.name} <${fromAddress.address}>`
									: (fromAddress.address ?? "")
								: "Unknown";

							emails.push({
								uid: msg.uid,
								subject: envelope.subject ?? "(no subject)",
								from: fromStr,
								date: envelope.date
									? envelope.date.toISOString()
									: new Date().toISOString(),
								seen: msg.flags?.has("\\Seen") ?? false,
							});
						}
					} finally {
						lock.release();
					}

					await client.logout();
					return { emails };
				} catch (err) {
					try {
						await client.logout();
					} catch {
						// ignore logout errors
					}
					return {
						emails: [],
						error: err instanceof Error ? err.message : String(err),
					};
				}
			},
		},
	},
});

const url = await getMainViewUrl();

new BrowserWindow({
	title: "CleanMail",
	url,
	titleBarStyle: "hidden",
	rpc,
});

console.log("Cleanmail started!");
