import type { RecommendedAction } from "../shared/rpc-types";

const PERSONAL_DOMAINS = new Set([
	"gmail.com",
	"hotmail.com",
	"outlook.com",
	"yahoo.com",
	"icloud.com",
	"proton.me",
	"protonmail.com",
	"live.com",
	"msn.com",
	"aol.com",
	"fastmail.com",
	"hey.com",
	"gmx.com",
	"gmx.net",
	"gmx.de",
	"yandex.com",
	"yandex.ru",
	"yandex.net",
]);

const PROMO_ECOMMERCE = [
	"uber",
	"aliexpress",
	"amazon",
	"paypal",
	"ebay",
	"order",
	"receipt",
	"transaction",
	"mailchimp",
	"substack",
	"medium",
	"newsletter",
	"no-reply",
	"noreply",
	"notify",
	"team",
	"support",
];

const SOCIAL_NOISE = [
	"pinterest",
	"facebook",
	"instagram",
	"twitter",
	"tiktok",
	"snapchat",
	"linkedin",
	"reddit",
	"whatsapp",
	"telegram",
];

const RECENCY_FALLBACK_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * Pure, local heuristic (no network/Bun APIs) that maps a sender group to a
 * recommended cleanup action. Order matters: PROMO/ECOMMERCE and SOCIAL/NOISE
 * domains win first, then known personal mailboxes, then recency/volume
 * fallbacks, with MARK_READ as the safe default.
 */
export function recommendAction(group: {
	authorEmail: string;
	count: number;
	lastDate: string;
	sampleSubjects: string[];
}): RecommendedAction {
	const domain = group.authorEmail.includes("@")
		? (group.authorEmail.split("@")[1]?.toLowerCase() ?? "")
		: group.authorEmail.toLowerCase();
	// Match the brand as a complete DNS label, not a loose substring. This
	// prevents false positives like "uber" matching "uberall.com" or "team"
	// matching "teamviewer.com", while still matching "amazon.co.uk" and
	// subdomains such as "mail.uber.com".
	const domainLabels = domain.split(".");
	const matches = (needle: string) => domainLabels.includes(needle);

	if (PROMO_ECOMMERCE.some(matches)) {
		return "ARCHIVE";
	}
	if (SOCIAL_NOISE.some(matches)) {
		return "TRASH";
	}

	if (PERSONAL_DOMAINS.has(domain)) {
		return group.count >= 20 ? "ARCHIVE" : "MARK_READ";
	}

	const ageMs = Date.now() - new Date(group.lastDate).getTime();
	if (ageMs > RECENCY_FALLBACK_MS && group.count >= 10) {
		return "ARCHIVE";
	}

	if (group.count >= 100) {
		return "ARCHIVE";
	}
	if (group.count >= 10) {
		return "TRASH";
	}
	return "MARK_READ";
}
