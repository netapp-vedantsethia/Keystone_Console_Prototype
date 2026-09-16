import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import {
  BpTableShell,
  BpTableRow,
  BpTableCell,
  BpTableHeaderCell,
  BpTablePagination,
  BpSearch,
  type BpTableSurface,
} from '@netapp/blueprint/react';
import { Button } from './button';
import { cn } from './utils';

interface DataTableProps {
  title: string;
  count?: number;
  children: ReactNode;
  onSearch?: (value: string) => void;
  onDownload?: () => void;
  showSearch?: boolean;
  showDownload?: boolean;
  actions?: ReactNode;
  /** `inner` for tables nested inside another table's expanded row, a drawer, or a modal; top-level page tables stay `standard` (default). */
  surface?: BpTableSurface;
}

/**
 * `BpTableShell` wraps its `children` directly in `<table class="bp-table__table">`
 * (Blueprint's row/cell styling is scoped to that class), and only accepts pagination as a
 * `BpTablePaginationProps` object rather than a rendered node. To keep every call site
 * unchanged — some nest `<DataTableFooter>` as the last child, others render it standalone —
 * this splits `children` into the `<table>` content (passed to the shell) and any
 * `DataTableFooter` elements (rendered as siblings below the shell, where `BpTablePagination`
 * renders identically whether inside or outside the shell).
 */
export function DataTable({
  title,
  count,
  children,
  onSearch,
  onDownload,
  showSearch = true,
  showDownload = true,
  actions,
  surface = 'standard',
}: DataTableProps) {
  let tableContent: ReactNode = null;
  const footers: ReactElement[] = [];
  const rest: ReactNode[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      if (child !== null && child !== undefined && child !== false) rest.push(child);
      return;
    }
    if (child.type === 'table') {
      tableContent = (child.props as { children?: ReactNode }).children;
    } else if (child.type === DataTableFooter) {
      footers.push(child);
    } else {
      rest.push(child);
    }
  });

  const hasToolbar = showSearch || showDownload || Boolean(actions);
  const toolbar = hasToolbar ? (
    <div className="flex items-center gap-3">
      {showSearch && (
        <BpSearch
          aria-label={`Search ${title}`}
          placeholder={`Search ${title.toLowerCase()}…`}
          onValueChange={(value) => onSearch?.(value)}
          onClear={() => onSearch?.('')}
        />
      )}
      {showDownload && (
        <Button variant="ghost" size="icon" onClick={onDownload} aria-label={`Download ${title}`}>
          <Download className="w-4 h-4" />
        </Button>
      )}
      {actions}
    </div>
  ) : undefined;

  return (
    <div className="rounded-[var(--radius-md)] overflow-hidden">
      <BpTableShell
        surface={surface}
        title={
          <>
            {title}
            {count !== undefined ? ` (${count})` : ''}
          </>
        }
        // Blueprint shows a placeholder ("This is a line of text that can contain details about
        // the table below.") whenever `details` is omitted — every one of our tables hit this
        // since we never had real per-table descriptions. Pass `null` to suppress it everywhere.
        details={null}
        toolbar={toolbar}
      >
        {tableContent}
      </BpTableShell>
      {footers}
      {rest}
    </div>
  );
}

interface DataTableHeaderProps {
  children: ReactNode;
}

export function DataTableHeader({ children }: DataTableHeaderProps) {
  return <thead>{children}</thead>;
}

interface DataTableHeaderCellProps {
  children?: ReactNode;
  sortable?: boolean;
  sorted?: 'asc' | 'desc' | null;
  onSort?: () => void;
  align?: 'left' | 'center' | 'right';
  /** Pins this column (e.g. a trailing action-menu/chevron column) to the row's trailing edge during horizontal scroll. */
  sticky?: 'end';
}

/** Shared sticky styling for the trailing action/chevron column — pins to `--background-table-header` (header) or `--background-content` (body) so the pinned cell stays opaque over scrolled content. */
const stickyEndCellClassName = 'sticky right-0 z-[1] bg-[var(--background-content)] shadow-[-1px_0_0_0_var(--border-main)]';
const stickyEndHeaderCellClassName = 'sticky right-0 z-[1] bg-[var(--background-table-header)] shadow-[-1px_0_0_0_var(--border-main)]';

export function DataTableHeaderCell({
  children,
  sortable = false,
  sorted = null,
  onSort,
  align = 'left',
  sticky,
}: DataTableHeaderCellProps) {
  return (
    <BpTableHeaderCell
      sortable={sortable}
      sortDirection={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
      onSortClick={sortable ? onSort : undefined}
      align={align === 'left' ? 'start' : align === 'right' ? 'end' : 'center'}
      className={sticky === 'end' ? stickyEndHeaderCellClassName : undefined}
    >
      {children}
    </BpTableHeaderCell>
  );
}

interface DataTableBodyProps {
  children: ReactNode;
}

export function DataTableBody({ children }: DataTableBodyProps) {
  return <tbody>{children}</tbody>;
}

interface DataTableRowProps {
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
}

export function DataTableRow({ children, onClick, selected = false }: DataTableRowProps) {
  return (
    <BpTableRow
      onClick={onClick}
      data-selected={selected ? 'true' : undefined}
      className={cn(onClick && 'cursor-pointer')}
    >
      {children}
    </BpTableRow>
  );
}

interface DataTableCellProps {
  children: ReactNode;
  align?: 'left' | 'center' | 'right';
  /** Pins this cell (e.g. a trailing action-menu/chevron cell) to the row's trailing edge during horizontal scroll. */
  sticky?: 'end';
}

export function DataTableCell({ children, align = 'left', sticky }: DataTableCellProps) {
  return (
    <BpTableCell
      align={align === 'left' ? 'start' : align === 'right' ? 'end' : 'center'}
      className={sticky === 'end' ? stickyEndCellClassName : undefined}
    >
      {children}
    </BpTableCell>
  );
}

interface DataTableFooterProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function DataTableFooter({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  className,
}: DataTableFooterProps) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = totalItems === 0 ? 0 : Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <BpTablePagination
      start={startItem}
      end={endItem}
      total={totalItems}
      page={currentPage}
      onFirstPage={() => onPageChange(1)}
      onPreviousPage={() => onPageChange(currentPage - 1)}
      onNextPage={() => onPageChange(currentPage + 1)}
      onLastPage={() => onPageChange(totalPages)}
      className={className}
    />
  );
}
