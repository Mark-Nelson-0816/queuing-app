import { getPagination } from "../utils/pagination";

const PAGE_SIZES = [10, 25, 50, 100];

// Builds compact page-number controls with gaps for long lists.
function buildPageItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const orderedPages = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((first, second) => first - second);
  const items = [];
  orderedPages.forEach((page, index) => {
    if (index > 0 && page - orderedPages[index - 1] > 1) items.push(`gap-${page}`);
    items.push(page);
  });
  return items;
}

// Displays record totals, page size, and page navigation controls.
export default function PaginationControls({
  page,
  pageSize,
  totalRecords,
  itemLabel = "records",
  onPageChange,
  onPageSizeChange,
}) {
  const pagination = getPagination(totalRecords, page, pageSize);
  const pageItems = buildPageItems(pagination.currentPage, pagination.totalPages);
  const firstRecord = totalRecords === 0 ? 0 : pagination.startIndex + 1;

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      {/* Record range and rows-per-page selector */}
      <div className="flex flex-wrap items-center gap-3 text-[var(--text)]">
        <span>
          Showing <strong className="text-[var(--text-h)]">{firstRecord}–{pagination.endIndex}</strong>
          {" "}of <strong className="text-[var(--text-h)]">{totalRecords}</strong> {itemLabel}
        </span>
        <label className="flex items-center gap-2">
          Rows per page
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[var(--text-h)]"
          >
            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>

      {/* Previous, numbered, and next page controls */}
      <div className="flex flex-wrap items-center gap-1" aria-label="Pagination">
        <span className="mr-2 text-xs font-semibold text-[var(--text)]">
          Page {pagination.currentPage} of {pagination.totalPages}
        </span>
        <button
          type="button"
          disabled={pagination.currentPage === 1}
          onClick={() => onPageChange(pagination.currentPage - 1)}
          className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-h)] disabled:opacity-40"
        >
          Previous
        </button>
        {pageItems.map((item) => (
          typeof item === "number" ? (
            <button
              key={item}
              type="button"
              aria-current={item === pagination.currentPage ? "page" : undefined}
              onClick={() => onPageChange(item)}
              className={`min-w-8 rounded-lg px-2 py-1.5 text-xs font-semibold ${
                item === pagination.currentPage
                  ? "bg-[var(--primary)] text-white"
                  : "border border-[var(--border)] text-[var(--text-h)]"
              }`}
            >
              {item}
            </button>
          ) : <span key={item} className="px-1 text-[var(--text)]">…</span>
        ))}
        <button
          type="button"
          disabled={pagination.currentPage === pagination.totalPages}
          onClick={() => onPageChange(pagination.currentPage + 1)}
          className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-h)] disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
