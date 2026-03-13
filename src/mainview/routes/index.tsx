import { createFileRoute } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
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
import { useEmails, useImapConfig } from "@/lib/queries/imap";
import type { Email } from "../../shared/rpc-types";
import { useMailboxContext } from "./__root";

export const Route = createFileRoute("/")({
	component: IndexPage,
});

const columns: ColumnDef<Email>[] = [
	{
		id: "status",
		header: "",
		size: 8,
		cell: ({ row }) =>
			row.original.seen ? null : (
				<span className="block size-2 rounded-full bg-primary" title="Unread" />
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
				className={row.original.seen ? "text-muted-foreground" : "font-medium"}
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
];

function IndexPage() {
	const [setupOpen, setSetupOpen] = useState(false);
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "date", desc: true },
	]);
	const { activeMailboxPath } = useMailboxContext();

	const { data: imapConfig, isLoading: configLoading } = useImapConfig();
	const {
		data: emailsData,
		isLoading: emailsLoading,
		isError,
		error,
		refetch,
	} = useEmails(activeMailboxPath);

	const emails = emailsData?.emails ?? [];
	const fetchError = emailsData?.error ?? (isError ? String(error) : null);

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

	// Display name for the active mailbox
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
							{table.getRowModel().rows.map((row) => (
								<TableRow key={row.id}>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</main>

			<ImapSetupDialog open={setupOpen} onOpenChange={setSetupOpen} />
		</div>
	);
}
