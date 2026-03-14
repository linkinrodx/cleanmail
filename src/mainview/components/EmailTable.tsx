import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { GripVerticalIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { Email } from "../../shared/rpc-types";

type EmailTableProps = {
	emails: Email[];
	/** Whether rows are draggable (only used on the main inbox page) */
	draggable?: boolean;
	draggingUid?: number | null;
	onDragStart?: (e: React.DragEvent<HTMLTableRowElement>, uid: number) => void;
	onDragEnd?: () => void;
	onDelete?: (uid: number) => void;
	onRowClick?: (uid: number) => void;
};

function buildColumns(onDelete?: (uid: number) => void): ColumnDef<Email>[] {
	const cols: ColumnDef<Email>[] = [];

	if (onDelete !== undefined) {
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

export function EmailTable({
	emails,
	draggable = false,
	draggingUid = null,
	onDragStart,
	onDragEnd,
	onDelete,
	onRowClick,
}: EmailTableProps) {
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "date", desc: true },
	]);

	const columns = buildColumns(onDelete);

	const table = useReactTable({
		data: emails,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	return (
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
							draggable={draggable}
							onDragStart={draggable ? (e) => onDragStart?.(e, uid) : undefined}
							onDragEnd={draggable ? onDragEnd : undefined}
							onClick={onRowClick ? () => onRowClick(uid) : undefined}
							className={`group/row ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${onRowClick ? "cursor-pointer" : ""} transition-opacity ${
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
	);
}
