import { useEffect, useRef, useState } from "react";
import { InfoIcon } from "lucide-react";
import { SuggestionRow } from "@/components/SuggestionRow";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSuggestions } from "@/hooks/queries/useSuggestions";

// Buckets mirror the "100+ / 50+ / 20+ / 10+ / 5+" volume tiers used in the
// clean.email reference. Thresholds are inclusive (`count >= min`) and the
// upper bound of each bucket is the `min` of the previous one.
const COUNT_BUCKETS = [
	{ label: "100+ emails", min: 100 },
	{ label: "50+ emails", min: 50 },
	{ label: "20+ emails", min: 20 },
	{ label: "10+ emails", min: 10 },
	{ label: "5+ emails", min: 5 },
] as const;

function ScanProgressPanel({
	phase,
	scanned,
	total,
	sendersFound,
	onStop,
}: {
	phase: string;
	scanned: number;
	total: number;
	sendersFound: number;
	onStop: () => void;
}) {
	const phaseLabel =
		phase === "search"
			? "Looking up messages…"
			: phase === "done"
				? "Finalizing…"
				: null;

	const pct = total > 0 ? Math.round((scanned / total) * 100) : undefined;

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-6">
			<div className="rounded-lg border p-4">
				<div className="flex items-center justify-between text-sm text-muted-foreground">
					<span>{phaseLabel ?? "Scanning…"}</span>
					{pct !== undefined ? (
						<span className="tabular-nums">{pct}%</span>
					) : null}
				</div>
				{/* Indeterminate pulsing bar — no inline styles needed */}
				<div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
					<div className="h-full animate-pulse rounded-full bg-primary w-full" />
				</div>
				<div className="mt-2 flex items-center justify-between">
					{phase === "envelopes" ? (
						<p className="text-xs text-muted-foreground tabular-nums">
							Scanning {scanned.toLocaleString()}/{total.toLocaleString()}{" "}
							messages {"\u00B7"} {sendersFound.toLocaleString()} senders
							{pct !== undefined ? ` (${pct}%)` : ""}
						</p>
					) : (
						<p className="text-xs text-muted-foreground">
							Scanning is read-only and safe to stop.
						</p>
					)}
					<Button size="sm" variant="ghost" onClick={onStop}>
						Stop
					</Button>
				</div>
			</div>
		</div>
	);
}

export function SuggestionsPage({ accountId }: { accountId: string }) {
	// Phase 1: suggestions are computed only for INBOX
	const mailboxPath = "INBOX";

	const {
		groups: allGroups,
		progress,
		isLoading,
		isScanning,
		error,
		cachedAt,
		startScan,
		cancelScan,
	} = useSuggestions(accountId, mailboxPath);

	const [dismissed, setDismissed] = useState<Set<string>>(new Set());

	function handleDismiss(authorEmail: string) {
		setDismissed((prev) => new Set(prev).add(authorEmail));
	}

	const groups = allGroups.filter((g) => !dismissed.has(g.authorEmail));

	// Preserve the scroll offset across navigation to/from the detail page
	// (the list lives in its own scroll container, so router scroll
	// restoration does not cover it).
	const mainRef = useRef<HTMLElement | null>(null);
	const restoredRef = useRef(false);
	const scrollKey = `suggestions:scroll:${accountId}`;

	useEffect(() => {
		if (restoredRef.current) return;
		const el = mainRef.current;
		if (!el || groups.length === 0) return;
		const saved = sessionStorage.getItem(scrollKey);
		if (saved) el.scrollTop = Number(saved);
		restoredRef.current = true;
	}, [groups.length, scrollKey]);

	function handleScroll(e: React.UIEvent<HTMLElement>) {
		sessionStorage.setItem(scrollKey, String(e.currentTarget.scrollTop));
	}

	// Partition by count bucket (buckets are ordered high -> low). The `upper`
	// bound of a bucket is the `min` of the previous one; the first bucket has
	// no upper limit.
	const sections = COUNT_BUCKETS.map((bucket, idx) => {
		const upper = idx === 0 ? Infinity : COUNT_BUCKETS[idx - 1].min;
		return {
			label: bucket.label,
			items: groups.filter((g) => g.count >= bucket.min && g.count < upper),
		};
	}).filter((section) => section.items.length > 0);

	return (
		<div className="flex h-svh w-full min-w-0 flex-col overflow-hidden bg-background">
			<TopBar
				title="Suggestions"
				isLoading={isScanning}
				refetch={() => startScan(true)}
			/>

			<main
				ref={mainRef}
				onScroll={handleScroll}
				className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto"
			>
				{error ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
						<p className="text-sm text-destructive">{error}</p>
						<Button variant="outline" onClick={() => startScan(true)}>
							Try again
						</Button>
					</div>
				) : isScanning || isLoading ? (
					<ScanProgressPanel
						phase={progress?.phase ?? "search"}
						scanned={progress?.scanned ?? 0}
						total={progress?.total ?? 0}
						sendersFound={progress?.sendersFound ?? 0}
						onStop={cancelScan}
					/>
				) : sections.length === 0 ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
						<p className="text-sm font-medium">No suggestions</p>
						<p className="max-w-md text-xs text-muted-foreground">
							Nothing to clean up right now — or the scan hasn't finished yet.
						</p>
					</div>
				) : (
					<>
						{/* About this page */}
						<div className="mx-auto flex w-full max-w-3xl justify-end px-4 pt-2">
							<Tooltip>
								<TooltipTrigger className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring">
									<InfoIcon className="size-3.5" />
									About
								</TooltipTrigger>
								<TooltipContent>
									Suggestions groups messages from the same sender that you
									rarely open (newsletters, promotions, notifications) and
									recommends a cleanup action for each. Apply one to clear all
									of that sender's messages, or open a suggestion to review them
									first. Nothing is changed until you act.
								</TooltipContent>
							</Tooltip>
						</div>

						{/* Cached-at row */}
						{cachedAt ? (
							<div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-2">
								<p className="text-xs text-muted-foreground">
									Updated{" "}
									<time dateTime={cachedAt}>
										{new Date(cachedAt).toLocaleString()}
									</time>
								</p>
							</div>
						) : null}

						{sections.map((section) => (
							<section key={section.label} className="flex min-w-0 flex-col">
								<h2 className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur-sm">
									<div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
										<span>{section.label}</span>
										<span className="tabular-nums">{section.items.length}</span>
									</div>
								</h2>
								<div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-3 p-4">
									{section.items.map((group) => (
										<SuggestionRow
											key={group.authorEmail}
											accountId={accountId}
											mailboxPath={mailboxPath}
											group={group}
											onDismiss={() => handleDismiss(group.authorEmail)}
										/>
									))}
								</div>
							</section>
						))}
					</>
				)}
			</main>
		</div>
	);
}
