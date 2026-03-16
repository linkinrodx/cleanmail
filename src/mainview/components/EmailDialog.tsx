import { Loader2Icon } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useEmailDetail } from "@/hooks/queries/useEmailDetail";
import { formatDate } from "@/lib/format";

type EmailDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mailboxPath: string;
	uid: number | null;
};

export function EmailDialog({
	open,
	onOpenChange,
	mailboxPath,
	uid,
}: EmailDialogProps) {
	const { data, isLoading, isError } = useEmailDetail(mailboxPath, uid, open);

	const email = data?.email ?? null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="flex max-h-[85vh] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0"
				showCloseButton
			>
				<DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
					{isLoading || !email ? (
						<div className="h-5 w-48 animate-pulse rounded bg-muted" />
					) : (
						<DialogTitle className="truncate text-base font-semibold">
							{email.subject}
						</DialogTitle>
					)}

					{isLoading || !email ? (
						<div className="mt-1 h-4 w-64 animate-pulse rounded bg-muted" />
					) : (
						<div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
							<span className="font-medium text-foreground">{email.from}</span>
							<span>{formatDate(email.date)}</span>
						</div>
					)}
				</DialogHeader>

				<div className="min-h-0 flex-1 overflow-y-auto">
					{isLoading && (
						<div className="flex h-40 items-center justify-center text-muted-foreground">
							<Loader2Icon className="mr-2 size-4 animate-spin" />
							Loading email…
						</div>
					)}

					{isError ? (
						<div className="flex h-40 items-center justify-center text-destructive text-sm">
							Failed to load email.
						</div>
					) : null}

					{!isLoading &&
						!isError &&
						email &&
						(email.htmlBody ? (
							<iframe
								srcDoc={email.htmlBody}
								sandbox="allow-same-origin"
								className="h-full min-h-[40vh] w-full border-none"
								title="Email content"
							/>
						) : (
							<pre className="whitespace-pre-wrap break-words px-6 py-4 font-sans text-sm leading-relaxed">
								{email.textBody ?? "(no content)"}
							</pre>
						))}
				</div>

				<DialogFooter showCloseButton className="shrink-0" />
			</DialogContent>
		</Dialog>
	);
}
