'use client';

import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FilterDef } from '../lib/useListView';

interface ListToolbarProps {
  q: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  filters?: FilterDef[];
  filterVals: Record<string, string>;
  onFilter: (key: string, value: string) => void;
  total: number;
  onExport?: () => void;
  // 分页
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}

export default function ListToolbar(props: ListToolbarProps) {
  const {
    q,
    onSearch,
    searchPlaceholder,
    filters = [],
    filterVals,
    onFilter,
    total,
    onExport,
    page,
    pageCount,
    onPage,
  } = props;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[180px] flex-[1_1_220px]">
        <Search
          size={14}
          className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground/70"
        />
        <input
          className="input w-full pl-[30px]"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchPlaceholder || '搜索…'}
        />
      </div>
      {filters.map((f) => (
        <select
          key={f.key}
          className="input w-auto min-w-[120px]"
          value={filterVals[f.key] || ''}
          onChange={(e) => onFilter(f.key, e.target.value)}
        >
          <option value="">{f.label}（全部）</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      <span className="t-xs ml-1 text-muted-foreground/80">共 {total} 条</span>
      <div className="ml-auto flex items-center gap-2">
        {pageCount > 1 && (
          <span className="inline-flex items-center gap-1">
            <button
              className="btn btn-outline btn-sm"
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
              aria-label="上一页"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="t-xs min-w-12 text-center text-muted-foreground tabular-nums">
              {page}/{pageCount}
            </span>
            <button
              className="btn btn-outline btn-sm"
              disabled={page >= pageCount}
              onClick={() => onPage(page + 1)}
              aria-label="下一页"
            >
              <ChevronRight size={14} />
            </button>
          </span>
        )}
        {onExport && (
          <button className="btn btn-outline btn-sm" onClick={onExport}>
            <Download size={14} />
            导出 CSV
          </button>
        )}
      </div>
    </div>
  );
}
