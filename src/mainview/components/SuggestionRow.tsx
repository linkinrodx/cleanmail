import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApplyActionContext } from "@/contexts/ApplyActionContext";
import { useApplyDeleteAction } from "@/hooks/mutations/useApplyDeleteAction";
import { useApplyMoveAction } from "@/hooks/mutations/useApplyMoveAction";
import { useMarkSenderRead } from "@/hooks/mutations/useMarkSenderRead";
import { useMailboxes } from "@/hooks/queries/useMailboxes";
import { useInvalidateSuggestion } from "@/hooks/useInvalidateSuggestion";
import { registerSuggestionJob } from "@/lib/suggestion-jobs";
import type { SenderGroup } from "../../shared/rpc-types";

type SuggestionRowProps = {
	accountId: string;
	mailboxPath: string;
	group: SenderGroup;
	onDismiss: () => void;
};

const ACTION_LABELS: Record<string, string> = {
	ARCHIVE: "Archive",
	TRASH: "Trash",
	DELETE: "Delete",
	MARK_READ: "Mark read",
};

const ACTION_COLORS: Record<string, string> = {
	ARCHIVE:
		"bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
	TRASH: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
	DELETE: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
	MARK_READ: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

export function SuggestionRow({
	accountId,
	mailboxPath,
	group,
	onDismiss,
}: SuggestionRowProps) {
	const { data: mailboxesData } = useMailboxes(accountId);
	const mailboxes = mailboxesData?.mailboxes ?? [];
	const archivePath = mailboxes.find((m) => m.specialUse === "\\Archive")?.path;
	const trashPath = mailboxes.find((m) => m.specialUse === "\\Trash")?.path;

	const moveMut = useApplyMoveAction(accountId);
	const deleteMut = useApplyDeleteAction(accountId);
	const markReadMut = useMarkSenderRead(accountId, mailboxPath);
	const invalidate = useInvalidateSuggestion(accountId, mailboxPath);
	const { jobs, setJobStatus } = useApplyActionContext();

	const [jobId, setJobId] = useState<string | null>(null);
	const jobState = jobId ? jobs[jobId] : undefined;
	const isBusy =
		jobState?.status === "pending" ||
		jobState?.status === "running" ||
		markReadMut.isPending;

	// Completion (toast + removing the sender from the suggestion cache) is
	// handled globally by SuggestionJobWatcher, so it fires even if the user
	// navigates away. Locally we only reflect the "Applying…" busy state.
	const label =
		ACTION_LABELS[group.recommendedAction] ?? group.recommendedAction;
	const colorClasses =
		ACTION_COLORS[group.recommendedAction] ?? "bg-muted text-muted-foreground";

	function handlePrimaryAction() {
		if (isBusy) return;
		switch (group.recommendedAction) {
			case "ARCHIVE": {
				if (!archivePath) return;
				const id = crypto.randomUUID();
				setJobId(id);
				setJobStatus(id, { status: "pending" });
				registerSuggestionJob(id, {
					accountId,
					mailboxPath,
					authorEmail: group.authorEmail,
				});
				moveMut.mutate({
					jobId: id,
					accountId,
					authorEmail: group.authorEmail,
					fromMailboxPath: mailboxPath,
					toMailboxPath: archivePath,
				});
				toast.success(`Archiving emails from ${group.authorEmail}`);
				break;
			}
			case "TRASH": {
				if (!trashPath) return;
				const id = crypto.randomUUID();
				setJobId(id);
				setJobStatus(id, { status: "pending" });
				registerSuggestionJob(id, {
					accountId,
					mailboxPath,
					authorEmail: group.authorEmail,
				});
				moveMut.mutate({
					jobId: id,
					accountId,
					authorEmail: group.authorEmail,
					fromMailboxPath: mailboxPath,
					toMailboxPath: trashPath,
				});
				toast.success(`Moving emails from ${group.authorEmail} to Trash`);
				break;
			}
			case "DELETE": {
				const id = crypto.randomUUID();
				setJobId(id);
				setJobStatus(id, { status: "pending" });
				registerSuggestionJob(id, {
					accountId,
					mailboxPath,
					authorEmail: group.authorEmail,
				});
				deleteMut.mutate({
					jobId: id,
					accountId,
					authorEmail: group.authorEmail,
					mailboxPath,
				});
				toast.success(`Deleting emails from ${group.authorEmail}`);
				break;
			}
			case "MARK_READ":
				markReadMut.mutate(
					{ authorEmail: group.authorEmail },
					{
						onSuccess: (res) => {
							toast.success(
								`Marked ${res.updatedCount ?? group.count} emails from ${group.authorEmail} as read`,
							);
							invalidate(group.authorEmail);
							onDismiss();
						},
						onError: (err) =>
							toast.error(err instanceof Error ? err.message : String(err)),
					},
				);
				break;
		}
	}

	const isPrimaryDisabled =
		isBusy ||
		(group.recommendedAction === "ARCHIVE" && !archivePath) ||
		(group.recommendedAction === "TRASH" && !trashPath);

	const primaryTitle =
		group.recommendedAction === "ARCHIVE" && !archivePath
			? "Archive mailbox not found"
			: group.recommendedAction === "TRASH" && !trashPath
				? "Trash mailbox not found"
				: undefined;

	return (
		<div className="flex w-full max-w-full min-w-0 flex-col gap-2 overflow-hidden rounded-lg border p-4">
			<div className="flex min-w-0 items-center justify-between gap-3">
				<div className="min-w-0 flex-1">
					<Link
						to="/account/$accountId/group/$mailbox/$authorEmail"
						params={{
							accountId,
							mailbox: mailboxPath,
							authorEmail: group.authorEmail,
						}}
						search={{ page: 1 }}
						className="block truncate text-sm font-medium hover:underline"
					>
						{group.authorEmail}
					</Link>
					<span className="mt-1 inline-flex w-fit items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums text-foreground">
						{group.count.toLocaleString()} email{group.count !== 1 ? "s" : ""}
					</span>
				</div>
				<span
					className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClasses}`}
				>
					{label}
				</span>
			</div>

			{group.sampleSubjects.length > 0 ? (
				<p className="truncate text-xs text-muted-foreground">
					{group.sampleSubjects.join(" · ")}
				</p>
			) : null}

			<div className="flex items-center gap-2 pt-1">
				<Button
					size="sm"
					onClick={handlePrimaryAction}
					disabled={isPrimaryDisabled}
					title={primaryTitle}
				>
					{isBusy ? "Applying…" : label}
				</Button>
				<Button size="sm" variant="ghost" onClick={onDismiss} disabled={isBusy}>
					Dismiss
				</Button>
			</div>
		</div>
	);
}
