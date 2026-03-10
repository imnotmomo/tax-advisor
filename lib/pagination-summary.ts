type PaginationSummaryOptions = {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  pageRowCount: number;
  filteredRowCount: number;
  hasFilter: boolean;
  recordLabel: string;
};

type PaginationSummary = {
  primary: string;
  secondary: string | null;
};

function formatRange(start: number, end: number) {
  if (start <= 0 || end <= 0) return "0";
  if (start === end) return String(start);
  return `${start}-${end}`;
}

export function getPaginationSummary({
  currentPage,
  pageSize,
  totalCount,
  pageRowCount,
  filteredRowCount,
  hasFilter,
  recordLabel,
}: PaginationSummaryOptions): PaginationSummary {
  const safeCurrentPage = Math.max(1, currentPage);
  const safePageSize = Math.max(1, pageSize);
  const safeTotalCount = Math.max(0, totalCount);
  const safePageRowCount = Math.max(0, pageRowCount);

  if (safeTotalCount === 0) {
    return {
      primary: `Showing 0 of 0 ${recordLabel}.`,
      secondary: null,
    };
  }

  const pageStart =
    safePageRowCount > 0
      ? Math.min(safeTotalCount, (safeCurrentPage - 1) * safePageSize + 1)
      : 0;
  const pageEnd =
    pageStart > 0 ? Math.min(safeTotalCount, pageStart + safePageRowCount - 1) : 0;
  const range = formatRange(pageStart, pageEnd);

  if (!hasFilter) {
    return {
      primary: `Showing ${range} of ${safeTotalCount} ${recordLabel}.`,
      secondary: null,
    };
  }

  return {
    primary: `Showing ${Math.max(0, filteredRowCount)} matching ${recordLabel} on this page.`,
    secondary: `Page range ${range} of ${safeTotalCount}.`,
  };
}
