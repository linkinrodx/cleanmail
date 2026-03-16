import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import { EMAILS_PER_PAGE } from "@/hooks/queries/useEmails";

type EmailsPaginationProps = {
	page: number;
	total: number;
	itemsPerPage?: number;
	onPageChange: (page: number) => void;
};

/**
 * Build the list of page numbers to show, with ellipsis for large ranges
 */
const getPageNumbers = (
	page: number,
	totalPages: number,
): (number | "ellipsis")[] => {
	if (totalPages <= 7) {
		return Array.from({ length: totalPages }, (_, i) => i + 1);
	}

	const pages: (number | "ellipsis")[] = [1];

	if (page > 3) {
		pages.push("ellipsis");
	}

	const start = Math.max(2, page - 1);
	const end = Math.min(totalPages - 1, page + 1);
	for (let i = start; i <= end; i++) {
		pages.push(i);
	}

	if (page < totalPages - 2) {
		pages.push("ellipsis");
	}

	pages.push(totalPages);

	return pages;
};

export function EmailsPagination({
	page,
	total,
	itemsPerPage = EMAILS_PER_PAGE,
	onPageChange,
}: EmailsPaginationProps) {
	const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));

	if (totalPages <= 1) {
		return null;
	}

	const pageNumbers = getPageNumbers(page, totalPages);

	return (
		<Pagination className="py-2">
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious
						onClick={(e) => {
							e.preventDefault();
							if (page > 1) {
								onPageChange(page - 1);
							}
						}}
						aria-disabled={page <= 1}
						className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
					/>
				</PaginationItem>

				{pageNumbers.map((p, i) =>
					p === "ellipsis" ? (
						// biome-ignore lint/suspicious/noArrayIndexKey: ellipsis items are stable positional
						<PaginationItem key={`ellipsis-${i}`}>
							<PaginationEllipsis />
						</PaginationItem>
					) : (
						<PaginationItem key={p}>
							<PaginationLink
								isActive={p === page}
								onClick={(e) => {
									e.preventDefault();
									onPageChange(p);
								}}
							>
								{p}
							</PaginationLink>
						</PaginationItem>
					),
				)}

				<PaginationItem>
					<PaginationNext
						onClick={(e) => {
							e.preventDefault();
							if (page < totalPages) {
								onPageChange(page + 1);
							}
						}}
						aria-disabled={page >= totalPages}
						className={
							page >= totalPages ? "pointer-events-none opacity-50" : undefined
						}
					/>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
