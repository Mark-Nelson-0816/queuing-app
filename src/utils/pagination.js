// Calculates safe page bounds for client-side pagination.
export function getPagination(totalRecords, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRecords);
  return { currentPage, totalPages, startIndex, endIndex };
}
