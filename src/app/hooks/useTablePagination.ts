import { useEffect, useState } from 'react';
import { TABLE_PAGE_SIZE } from '../constants/tablePagination';

export function useTablePagination(
  totalItems: number,
  pageSize: number = TABLE_PAGE_SIZE,
  resetDeps: readonly unknown[] = []
) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalItems) / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, resetDeps);

  useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  return { currentPage, setCurrentPage, totalPages, pageSize };
}

export function slicePage<T>(items: readonly T[], currentPage: number, pageSize: number): T[] {
  const start = (currentPage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
