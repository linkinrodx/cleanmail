import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { GripVerticalIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmailDialog } from "@/components/EmailDialog";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useDeleteEmail, useMailboxes, useMoveEmail } from "@/lib/queries/imap";
import type { Email } from "../../shared/rpc-types";
import { useActionsContext, useDragContext } from "../routes/__root";

/** Extract the bare email address from a "Name <addr>" or plain "addr" string */
function extractEmailAddress(from: string): string {
	const match = from.match(/<([^>]+)>/);
	return match ? match[1].trim() : from.trim();
}

type EmailTableProps = {
	emails: Email[];
	mailboxPath: string;
};

function buildColumns(
	withDragHandle: boolean,
	onDelete?: (uid: number) => void,
): ColumnDef<Email>[] {
	const cols: ColumnDef<Email>[] = [];

	if (withDragHandle) {
		cols.push({
			id: "drag-handle",
			header: "",
			size: 24,
			cell: () => (
				<GripVerticalIcon className="size-3.5 text-muted-foreground/40 group-hover/row:text-muted-foreground/70 transition-colors" />
			),
		});
	}

	cols.push(
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
	);

	if (onDelete !== undefined) {
		cols.push({
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
		});
	}

	return cols;
}

export function EmailTable({ emails, mailboxPath }: EmailTableProps) {
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "date", desc: true },
	]);
	const [selectedUid, setSelectedUid] = useState<number | null>(null);

	const { draggingUid, setDraggingUid, registerDropHandler } = useDragContext();
	const { addAction } = useActionsContext();

	const { data: mailboxesData } = useMailboxes();
	const trashMailboxPath = mailboxesData?.mailboxes.find(
		(m) => m.specialUse === "\\Trash",
	)?.path;

	const { mutate: deleteEmail } = useDeleteEmail(mailboxPath, trashMailboxPath);
	const { mutate: moveEmail } = useMoveEmail(mailboxPath);

	// Register the drop handler so the sidebar can trigger a move
	useEffect(() => {
		registerDropHandler((toMailboxPath) => {
			if (draggingUid === null) return;
			if (toMailboxPath === mailboxPath) return;

			const uid = draggingUid;

			const email = emails.find((e) => e.uid === uid);
			const authorEmail = email ? extractEmailAddress(email.from) : "";

			const toastId = toast.loading("Moving email…");

			moveEmail(
				{ uid, toMailboxPath },
				{
					onSuccess: (result) => {
						if (result.success) {
							toast.success("Email moved", { id: toastId });
							if (authorEmail) {
								addAction({
									type: "move",
									uid,
									authorEmail,
									fromMailboxPath: mailboxPath,
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
		emails,
		mailboxPath,
		addAction,
	]);

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
		const email = emails.find((e) => e.uid === uid);
		const authorEmail = email ? extractEmailAddress(email.from) : "";

		deleteEmail(uid, {
			onSuccess: (result) => {
				if (result.success && authorEmail) {
					addAction({
						type: "delete",
						uid,
						authorEmail,
						mailboxPath,
					});
				}
			},
		});
	}

	const columns = buildColumns(true, handleDelete);

	const table = useReactTable({
		data: emails,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	return (
		<>
			<Table>
				<TableHeader>
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map((header) => (
								<TableHead key={header.id} style={{ width: header.getSize() }}>
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
								onClick={() => setSelectedUid(uid)}
								className={`group/row cursor-grab active:cursor-grabbing cursor-pointer transition-opacity ${
									isDragging ? "opacity-40" : ""
								}`}
							>
								{row.getVisibleCells().map((cell) => (
									<TableCell key={cell.id}>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</TableCell>
								))}
							</TableRow>
						);
					})}
				</TableBody>
			</Table>

			<EmailDialog
				open={selectedUid !== null}
				onOpenChange={(open) => {
					if (!open) setSelectedUid(null);
				}}
				mailboxPath={mailboxPath}
				uid={selectedUid}
			/>
		</>
	);
}
