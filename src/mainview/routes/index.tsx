import { createFileRoute } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { GripVerticalIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	ImapSetupDialog,
	ImapSetupTrigger,
} from "@/components/ImapSetupDialog";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	useDeleteEmail,
	useEmails,
	useImapConfig,
	useMailboxes,
	useMoveEmail,
} from "@/lib/queries/imap";
import type { Email } from "../../shared/rpc-types";
import { useActionsContext, useDragContext, useMailboxContext } from "./__root";

export const Route = createFileRoute("/")({
	component: IndexPage,
});

/** Extract the bare email address from a "Name <addr>" or plain "addr" string */
function extractEmailAddress(from: string): string {
	const match = from.match(/<([^>]+)>/);
	return match ? match[1].trim() : from.trim();
}

function buildColumns(onDelete: (uid: number) => void): ColumnDef<Email>[] {
	return [
		{
			id: "drag-handle",
			header: "",
			size: 24,
			cell: () => (
				<GripVerticalIcon className="size-3.5 text-muted-foreground/40 group-hover/row:text-muted-foreground/70 transition-colors" />
			),
		},
		{
			id: "status",
			header: "",
			size: 8,
			cell: ({ row }) =>
				row.original.seen ? null : (
					<span
						className="block size-2 rounded-full bg-primary"
						title="Unread"
					/>
				),
		},
		{
			accessorKey: "from",
			header: "From",
			cell: ({ getValue }) => (
				<span className="block max-w-48 truncate">{String(getValue())}</span>
			),
		},
		{
			accessorKey: "subject",
			header: "Subject",
			cell: ({ row, getValue }) => (
				<span
					className={
						row.original.seen ? "text-muted-foreground" : "font-medium"
					}
				>
					{String(getValue())}
				</span>
			),
		},
		{
			accessorKey: "date",
			header: "Date",
			cell: ({ getValue }) => {
				const iso = String(getValue());
				const date = new Date(iso);
				const now = new Date();
				const isToday = date.toDateString() === now.toDateString();
				return (
					<span className="whitespace-nowrap text-xs text-muted-foreground">
						{isToday
							? date.toLocaleTimeString(undefined, {
									hour: "2-digit",
									minute: "2-digit",
								})
							: date.toLocaleDateString(undefined, {
									month: "short",
									day: "numeric",
									year:
										date.getFullYear() !== now.getFullYear()
											? "numeric"
											: undefined,
								})}
					</span>
				);
			},
		},
		{
			id: "actions",
			header: "",
			size: 32,
			cell: ({ row }) => (
				<Button
					variant="ghost"
					size="icon-sm"
					title="Delete"
					onClick={(e) => {
						e.stopPropagation();
						onDelete(row.original.uid);
					}}
					className="text-muted-foreground hover:text-destructive"
				>
					<Trash2Icon data-icon="inline" />
					<span className="sr-only">Delete</span>
				</Button>
			),
		},
	];
}

function IndexPage() {
	const [setupOpen, setSetupOpen] = useState(false);
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "date", desc: true },
	]);
	const { activeMailboxPath } = useMailboxContext();
	const { draggingUid, setDraggingUid, registerDropHandler } = useDragContext();
	const { addAction } = useActionsContext();

	const { data: imapConfig, isLoading: configLoading } = useImapConfig();
	const { data: mailboxesData } = useMailboxes();
	const trashMailboxPath = mailboxesData?.mailboxes.find(
		(m) => m.specialUse === "\\Trash",
	)?.path;
	const {
		data: emailsData,
		isLoading: emailsLoading,
		isError,
		error,
		refetch,
	} = useEmails(activeMailboxPath);
	const { mutate: deleteEmail } = useDeleteEmail(
		activeMailboxPath,
		trashMailboxPath,
	);
	const { mutate: moveEmail } = useMoveEmail(activeMailboxPath);

	const emails = emailsData?.emails ?? [];

	// Register the drop handler so the sidebar can trigger a move
	useEffect(() => {
		registerDropHandler((toMailboxPath) => {
			if (draggingUid === null) return;
			if (toMailboxPath === activeMailboxPath) return;

			const uid = draggingUid;

			// Find the email being dragged to get its author address
			const email = emails.find((e) => e.uid === uid);
			const authorEmail = email ? extractEmailAddress(email.from) : "";

			const toastId = toast.loading("Moving email…");

			moveEmail(
				{ uid, toMailboxPath },
				{
					onSuccess: (result) => {
						if (result.success) {
							toast.success("Email moved", { id: toastId });
							// Record the action for the sidebar
							if (authorEmail) {
								addAction({
									type: "move",
									uid,
									authorEmail,
									fromMailboxPath: activeMailboxPath,
									toMailboxPath,
								});
							}
						} else {
							toast.error(result.error ?? "Failed to move email", {
								id: toastId,
							});
						}
					},
					onError: (err) => {
						toast.error(
							err instanceof Error ? err.message : "Failed to move email",
							{ id: toastId },
						);
					},
				},
			);
		});
	}, [
		registerDropHandler,
		moveEmail,
		draggingUid,
		activeMailboxPath,
		emails,
		addAction,
	]);

	const fetchError = emailsData?.error ?? (isError ? String(error) : null);

	function handleDragStart(
		e: React.DragEvent<HTMLTableRowElement>,
		uid: number,
	) {
		e.dataTransfer.setData("application/x-cleanmail-email-uid", String(uid));
		e.dataTransfer.effectAllowed = "move";
		setDraggingUid(uid);
	}

	function handleDragEnd() {
		setDraggingUid(null);
	}

	function handleDelete(uid: number) {
		// Find the email to get the author address before deletion
		const email = emails.find((e) => e.uid === uid);
		const authorEmail = email ? extractEmailAddress(email.from) : "";

		deleteEmail(uid, {
			onSuccess: (result) => {
				if (result.success && authorEmail) {
					addAction({
						type: "delete",
						uid,
						authorEmail,
						mailboxPath: activeMailboxPath,
					});
				}
			},
		});
	}

	const columns = buildColumns(handleDelete);

	const table = useReactTable({
		data: emails,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	const isLoading = configLoading || emailsLoading;
	const isConfigured = !!imapConfig;

	const mailboxDisplayName =
		activeMailboxPath === "INBOX"
			? "Inbox"
			: (activeMailboxPath.split(/[./\\]/).pop() ?? activeMailboxPath);

	return (
		<div className="flex min-h-screen flex-col bg-background">
			{/* Top bar */}
			<header className="flex items-center justify-between border-b px-2 py-2">
				<div className="flex items-center gap-2">
					<SidebarTrigger />
					<h1 className="text-sm font-semibold tracking-tight">
						{mailboxDisplayName}
					</h1>
				</div>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => refetch()}
						disabled={isLoading}
						title="Refresh"
					>
						<RefreshCwIcon
							data-icon="inline"
							className={isLoading ? "animate-spin" : undefined}
						/>
						<span className="sr-only">Refresh</span>
					</Button>
					<ImapSetupTrigger onOpenChange={setSetupOpen} />
				</div>
			</header>

			{/* Main content */}
			<main className="flex flex-1 flex-col">
				{!isConfigured && !configLoading ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
						<p className="text-sm text-muted-foreground">
							No IMAP account configured yet.
						</p>
						<Button onClick={() => setSetupOpen(true)}>
							Set up IMAP Account
						</Button>
					</div>
				) : fetchError ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
						<p className="text-sm text-destructive">{fetchError}</p>
						<Button variant="outline" onClick={() => refetch()}>
							Try again
						</Button>
					</div>
				) : isLoading ? (
					<div className="flex flex-1 items-center justify-center p-8">
						<p className="text-sm text-muted-foreground">Loading…</p>
					</div>
				) : emails.length === 0 ? (
					<div className="flex flex-1 items-center justify-center p-8">
						<p className="text-sm text-muted-foreground">No emails found.</p>
					</div>
				) : (
					<Table>
						<TableHeader>
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{headerGroup.headers.map((header) => (
										<TableHead
											key={header.id}
											style={{ width: header.getSize() }}
										>
											{flexRender(
												header.column.columnDef.header,
												header.getContext(),
											)}
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{table.getRowModel().rows.map((row) => {
								const uid = row.original.uid;
								const isDragging = draggingUid === uid;
								return (
									<TableRow
										key={row.id}
										draggable
										onDragStart={(e) => handleDragStart(e, uid)}
										onDragEnd={handleDragEnd}
										className={`group/row cursor-grab active:cursor-grabbing transition-opacity ${
											isDragging ? "opacity-40" : ""
										}`}
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id}>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</TableCell>
										))}
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				)}
			</main>

			<ImapSetupDialog open={setupOpen} onOpenChange={setSetupOpen} />
		</div>
	);
}
