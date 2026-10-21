import './data-table.css';
import { Fragment, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, X } from 'lucide-react';
import type { BadgeTone } from './primitives';
import type { TableSort } from './tableSort';

/**
 * Lists of records, the same way everywhere: views with counts, one toolbar (search, filter pills, count), then a
 * table with column headers, rows grouped where it helps and details tucked under a row. Every piece is driven by
 * plain state the page keeps in the URL (view, q, filters, sort, page), so server-side querying plugs in later
 * without changing the screen.
 */

export interface Column<T> {
    id: string;
    label: ReactNode;
    /** A CSS grid track, for example `minmax(0, 2fr)` or `140px`. */
    width?: string;
    align?: 'start' | 'end';
    sortable?: boolean;
    /** Shown before the value when rows stack on a narrow screen and the column header is gone ("Joined"). */
    narrowLabel?: string;
    render: (row: T) => ReactNode;
}

/** An empty value: a quiet dash in the table, left out when rows stack on a narrow screen. */
export const EMPTY_CELL = <span className="gk-dt-muted gk-dt-empty">—</span>;

export interface RowGroup<T> { key: string; label: ReactNode; tone?: 'danger' | 'warning'; rows: T[] }


interface DataTableProps<T> {
    label: string;
    columns: Column<T>[];
    rows?: T[];
    /** Rows in labelled groups (a queue by urgency, for example); empty groups are left out. */
    groups?: RowGroup<T>[];
    rowKey: (row: T) => string | number;
    /** Opening a row: a click anywhere on it that is not a control. Rows without it open their details instead. */
    onOpen?: (row: T) => void;
    /** Controls at the end of a row. They stay quiet until the row is hovered or focused, except those marked `gk-dt__keep`. */
    actions?: (row: T) => ReactNode;
    /** Details that open under a row instead of crowding it; return null when a row has none. */
    details?: (row: T) => ReactNode | null;
    sort?: TableSort | null;
    onSort?: (by: string) => void;
    footer?: ReactNode;
    /** Rows whose details start open, for example the one a link pointed at. */
    defaultOpen?: (string | number)[];
}

const CONTROLS = 'a, button, input, select, textarea, label, summary, [role="button"]';

export function DataTable<T>({ label, columns, rows, groups, rowKey, onOpen, actions, details, sort, onSort, footer, defaultOpen }: DataTableProps<T>) {
    const [open, setOpen] = useState<ReadonlySet<string | number>>(() => new Set(defaultOpen));
    const hasEnd = Boolean(actions || details);
    const style = { '--dt-columns': [...columns.map(column => column.width ?? 'minmax(0, 1fr)'), ...(hasEnd ? ['auto'] : [])].join(' ') } as CSSProperties;
    const toggle = (key: string | number) => setOpen(current => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });

    const line = (row: T) => {
        const key = rowKey(row), more = details?.(row) ?? null, expanded = open.has(key) && more !== null;
        const activate = onOpen ? () => onOpen(row) : more !== null ? () => toggle(key) : null;
        const clicked = (event: MouseEvent) => { if (!(event.target as HTMLElement).closest(CONTROLS)) activate?.(); };
        return <Fragment key={key}>
            <div role="row" data-row-key={key} className={`gk-dt__row${activate ? ' gk-dt__row--open' : ''}${expanded ? ' gk-dt__row--expanded' : ''}`} onClick={activate ? clicked : undefined}>
                {columns.map((column, index) => <div role="cell" key={column.id} className={`gk-dt__cell${index === 0 ? ' gk-dt__cell--primary' : ''}${column.align === 'end' ? ' gk-dt__cell--end' : ''}`}>{column.narrowLabel && <span className="gk-dt__narrow-label">{column.narrowLabel}</span>}{column.render(row)}</div>)}
                {hasEnd && <div role="cell" className="gk-dt__end">
                    {actions?.(row)}
                    {more !== null && <button type="button" className="gk-dt__toggle gk-dt__keep" aria-expanded={expanded} aria-label={expanded ? 'Hide details' : 'Show details'} onClick={() => toggle(key)}><ChevronDown aria-hidden="true" /></button>}
                </div>}
            </div>
            {expanded && <div role="row" className="gk-dt__details"><div role="cell">{more}</div></div>}
        </Fragment>;
    };

    return <div className="gk-dt" style={style}><div className="gk-dt__grid" role="table" aria-label={label}>
        <div role="row" className="gk-dt__head">
            {columns.map(column => <div role="columnheader" key={column.id} className={`gk-dt__th${column.align === 'end' ? ' gk-dt__cell--end' : ''}`}
                aria-sort={sort?.by === column.id ? (sort.descending ? 'descending' : 'ascending') : undefined}>
                {column.sortable && onSort
                    ? <button type="button" className="gk-dt__sort" onClick={() => onSort(column.id)}>{column.label}{sort?.by === column.id
                        ? sort.descending ? <ArrowDown aria-hidden="true" /> : <ArrowUp aria-hidden="true" />
                        : <ArrowUpDown className="gk-dt__sort-idle" aria-hidden="true" />}</button>
                    : column.label}
            </div>)}
            {hasEnd && <div role="columnheader" className="gk-dt__th"><span className="gk-visually-hidden">Actions</span></div>}
        </div>
        {groups
            ? groups.filter(group => group.rows.length).map(group => <div role="rowgroup" key={group.key} className="gk-dt__group" data-tone={group.tone}>
                <div role="row" className="gk-dt__group-head"><div role="cell">
                    <span className="gk-dt__group-label">{group.label}</span><span className="gk-dt__group-count">{group.rows.length}</span>
                </div></div>
                {group.rows.map(line)}
            </div>)
            : <div role="rowgroup">{rows?.map(line)}</div>}
    </div>{footer && <div className="gk-dt__foot">{footer}</div>}</div>;
}

/** The first cell of a row: an icon or avatar, the title (a link or a button that opens the row) and a quiet subtitle. */
export function PrimaryCell({ lead, title, subtitle }: { lead?: ReactNode; title: ReactNode; subtitle?: ReactNode }) {
    return <span className="gk-dt-primary">
        {lead && <span className="gk-dt-primary__lead">{lead}</span>}
        <span className="gk-dt-primary__text">
            {typeof title === 'string' ? <span className="gk-dt-primary__title">{title}</span> : title}
            {subtitle && <span className="gk-dt-primary__sub">{subtitle}</span>}
        </span>
    </span>;
}

/** A status as a coloured dot and its word. The colour repeats what the word says. */
export function Status({ tone = 'neutral', children, title }: { tone?: BadgeTone; children: ReactNode; title?: string }) {
    return <span className="gk-status" data-tone={tone} title={title}><span className="gk-status__dot" aria-hidden="true" />{children}</span>;
}

export interface ListView { id: string; label: ReactNode; count?: number }

/** Ways to look at a list (All · On trial · Active…), each with its count when the server knows it. */
export function ViewTabs({ views, value, onChange, label }: { views: ListView[]; value: string; onChange: (id: string) => void; label: string }) {
    return <div className="gk-views" role="group" aria-label={label}>
        {views.map(view => <button key={view.id} type="button" className="gk-view" aria-pressed={view.id === value} onClick={() => onChange(view.id)}>
            {view.label}{view.count != null && <span className="gk-view__count">{view.count}</span>}
        </button>)}
    </div>;
}

/** One toolbar above a list: search and filters on the left, a way to clear them, the result count on the right. */
export function ListToolbar({ children, count, onClear }: { children: ReactNode; count?: ReactNode; onClear?: () => void }) {
    return <div className="gk-list-toolbar">
        {children}
        {onClear && <button type="button" className="gk-list-toolbar__clear" onClick={onClear}><X aria-hidden="true" />Clear filters</button>}
        {count != null && <span className="gk-list-toolbar__count" role="status">{count}</span>}
    </div>;
}

export interface FilterOption { value: string; label: string; group?: string }

/** A filter as a compact pill: its name, the chosen value, a chevron. Highlighted while it narrows the list. */
export function FilterSelect({ label, value, onChange, options, allLabel }: { label: string; value: string; onChange: (value: string) => void; options: FilterOption[]; allLabel: string }) {
    const groups = [...new Set(options.map(option => option.group ?? ''))];
    const list = (items: FilterOption[]) => items.map(option => <option key={option.value} value={option.value}>{option.label}</option>);
    return <label className={`gk-filter${value ? ' gk-filter--on' : ''}`}>
        <span className="gk-filter__label">{label}</span>
        <select value={value} onChange={event => onChange(event.target.value)}>
            <option value="">{allLabel}</option>
            {groups.some(Boolean) ? groups.map(group => <optgroup key={group} label={group}>{list(options.filter(option => (option.group ?? '') === group))}</optgroup>) : list(options)}
        </select>
        <ChevronDown aria-hidden="true" />
    </label>;
}
