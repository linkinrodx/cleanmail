import type { ColumnDef } from "@tanstack/react-table";
import { GripVerticalIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Email } from "../../shared/rpc-types";

export function buildColumns(
	withDragHandle: boolean,
	onDelete?: (uid: number) => void,
	pendingUid?: number | null,
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
					title={String(getValue())}
					className={`block max-w-2xl truncate ${
						row.original.seen ? "text-muted-foreground" : "font-medium"
					}`}
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
			cell: ({ row }) => {
				const isPending = pendingUid === row.original.uid;
				return (
					<Button
						variant="ghost"
						size="icon-sm"
						title="Delete"
						disabled={isPending}
						onClick={(e) => {
							e.stopPropagation();
							onDelete(row.original.uid);
						}}
						className="text-muted-foreground hover:text-destructive"
					>
						{isPending ? (
							<Loader2Icon data-icon="inline" className="animate-spin" />
						) : (
							<Trash2Icon data-icon="inline" />
						)}
						<span className="sr-only">Delete</span>
					</Button>
				);
			},
		});
	}

	return cols;
}
