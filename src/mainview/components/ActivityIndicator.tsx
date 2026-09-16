import { useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { useApplyActionContext } from "@/contexts/ApplyActionContext";
import { addGroupScanListener, removeGroupScanListener } from "@/lib/rpc";
import type { GroupScanProgress } from "../../shared/rpc-types";

/**
 * A small, always-available signal that a background process is running: a
 * suggestions scan (with percent, since the scan reports scanned/total) or a
 * bulk email job (archive/trash/delete). Mounted at the app root so it stays
 * visible even after navigating away from the screen that started the work.
 */
export function ActivityIndicator() {
	const { jobs } = useApplyActionContext();
	const [scan, setScan] = useState<GroupScanProgress | null>(null);

	useEffect(() => {
		function onProgress(p: GroupScanProgress) {
			if (p.status === "scanning") {
				setScan(p);
			} else {
				setScan((prev) =>
					prev &&
					prev.accountId === p.accountId &&
					prev.mailboxPath === p.mailboxPath
						? null
						: prev,
				);
			}
		}
		addGroupScanListener(onProgress);
		return () => removeGroupScanListener(onProgress);
	}, []);

	const bulkActive = Object.values(jobs).some(
		(job) => job.status === "pending" || job.status === "running",
	);
	const scanning = scan !== null;
	const active = scanning || bulkActive;

	if (!active) {
		return null;
	}

	const pct =
		scan && scan.total > 0
			? Math.round((scan.scanned / scan.total) * 100)
			: null;
	const label = scanning
		? `Scanning inbox${pct !== null ? ` ${pct}%` : "\u2026"}`
		: "Applying\u2026";

	return (
		<output className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur">
			<Loader2Icon className="size-3.5 animate-spin" />
			<span className="tabular-nums">{label}</span>
		</output>
	);
}
