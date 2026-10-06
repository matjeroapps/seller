'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Pencil, Archive } from 'lucide-react';
import type { CategoryStatus, StoreCategory } from '@/lib/api/types';

// CategoryTree renders the store's categories as an indented hierarchy from
// the flat node list, with per-node status actions and sibling reordering.
// Reorder is expressed as move up/down within the sibling set (keyboard
// accessible, no drag-drop dependency).

export interface CategoryTreeProps {
  categories: StoreCategory[];
  locale: string;
  busy?: boolean;
  onEdit: (category: StoreCategory) => void;
  onStatus: (category: StoreCategory, status: CategoryStatus) => void;
  onDelete: (category: StoreCategory) => void;
  onMove: (category: StoreCategory, direction: 'up' | 'down') => void;
  labels: {
    edit: string;
    archive: string;
    restore: string;
    activate: string;
    deactivate: string;
    moveUp: string;
    moveDown: string;
    products: string;
    subcategories: string;
    delete: string;
  };
}

interface CategoryNode {
  category: StoreCategory;
  children: CategoryNode[];
}

function buildTree(categories: StoreCategory[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>();
  for (const category of categories) {
    byId.set(category.id, { category, children: [] });
  }
  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    const parentId = node.category.parent_category_id;
    const parent = parentId ? byId.get(parentId) : undefined;
    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort(
      (a, b) =>
        a.category.sort_order - b.category.sort_order ||
        a.category.created_at.localeCompare(b.category.created_at) ||
        a.category.id.localeCompare(b.category.id)
    );
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);
  return roots;
}

function localizedCategoryName(category: StoreCategory, locale: string): string {
  const en = category.translations?.en?.name;
  const ar = category.translations?.ar?.name;
  if (locale === 'ar') return ar || en || category.slug;
  return en || ar || category.slug;
}

const statusBadgeStyles: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-amber-100 text-amber-700',
  archived: 'bg-slate-200 text-slate-600'
};

function TreeRow({
  node,
  depth,
  locale,
  busy,
  collapsed,
  onToggle,
  labels,
  onEdit,
  onStatus,
  onDelete,
  onMove,
  siblingCount,
  siblingIndex
}: {
  node: CategoryNode;
  depth: number;
  locale: string;
  busy: boolean;
  collapsed: Set<string>;
  onToggle: () => void;
  labels: CategoryTreeProps['labels'];
  onEdit: CategoryTreeProps['onEdit'];
  onStatus: CategoryTreeProps['onStatus'];
  onDelete: CategoryTreeProps['onDelete'];
  onMove: CategoryTreeProps['onMove'];
  siblingCount: number;
  siblingIndex: number;
}) {
  const { category } = node;
  const hasChildren = node.children.length > 0;
  const expanded = !collapsed.has(category.id);
  const name = localizedCategoryName(category, locale);
  const isArchived = category.status === 'archived';

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined} className="select-none">
      <div
        className={`group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50 ${
          isArchived ? 'opacity-60' : ''
        }`}
        style={{ paddingInlineStart: `${depth * 20 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            className="rounded p-0.5 text-slate-500 hover:bg-slate-200"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="w-5" aria-hidden="true" />
        )}

        <span className={`min-w-0 flex-1 truncate text-sm font-medium text-slate-800`}>{name}</span>
        <span className="hidden truncate font-mono text-xs text-slate-400 sm:block">{category.slug}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeStyles[category.status] ?? ''}`}>
          {category.status}
        </span>
        {category.child_count > 0 && (
          <span className="text-xs text-slate-400">
            {category.child_count} {labels.subcategories}
          </span>
        )}
        {category.product_count > 0 && (
          <span className="text-xs text-slate-400">
            {category.product_count} {labels.products}
          </span>
        )}

        <span className="flex items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          <button
            type="button"
            onClick={() => onMove(category, 'up')}
            disabled={busy || siblingIndex === 0}
            aria-label={`${labels.moveUp}: ${name}`}
            className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onMove(category, 'down')}
            disabled={busy || siblingIndex === siblingCount - 1}
            aria-label={`${labels.moveDown}: ${name}`}
            className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronUp className="h-4 w-4 rotate-180" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onEdit(category)}
            disabled={busy}
            aria-label={`${labels.edit}: ${name}`}
            className="rounded p-1 text-slate-500 hover:bg-slate-200"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onStatus(category, isArchived ? 'active' : 'archived')}
            disabled={busy}
            aria-label={`${isArchived ? labels.restore : labels.archive}: ${name}`}
            className="rounded p-1 text-slate-500 hover:bg-slate-200"
          >
            <Archive className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => (category.status === 'active' ? onStatus(category, 'inactive') : onStatus(category, 'active'))}
            disabled={busy}
            aria-label={`${category.status === 'active' ? labels.deactivate : labels.activate}: ${name}`}
            className="rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-200"
          >
            {category.status === 'active' ? labels.deactivate : labels.activate}
          </button>
          <button
            type="button"
            onClick={() => onDelete(category)}
            disabled={busy || category.child_count > 0 || category.product_count > 0}
            title={category.child_count > 0 || category.product_count > 0 ? labels.delete : undefined}
            aria-label={`${labels.delete}: ${name}`}
            className="rounded border border-rose-200 px-1.5 py-0.5 text-xs text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {labels.delete}
          </button>
        </span>
      </div>

      {hasChildren && expanded && (
        <ul role="group" className="list-none">
          {node.children.map((child, index) => (
            <TreeRow
              key={child.category.id}
              node={child}
              depth={depth + 1}
              locale={locale}
              busy={busy}
              collapsed={collapsed}
              onToggle={onToggle}
              labels={labels}
              onEdit={onEdit}
              onStatus={onStatus}
              onDelete={onDelete}
              onMove={onMove}
              siblingCount={node.children.length}
              siblingIndex={index}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CategoryTree({
  categories,
  locale,
  busy,
  onEdit,
  onStatus,
  onDelete,
  onMove,
  labels
}: CategoryTreeProps) {
  const tree = useMemo(() => buildTree(categories), [categories]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderLevel = (nodes: CategoryNode[], depth: number) => (
    <ul role="group" className="list-none">
      {nodes.map((node, index) => (
        <TreeRow
          key={node.category.id}
          node={node}
          depth={depth}
          locale={locale}
          busy={Boolean(busy)}
          collapsed={collapsed}
          onToggle={() => toggle(node.category.id)}
          labels={labels}
          onEdit={onEdit}
          onStatus={onStatus}
          onDelete={onDelete}
          onMove={onMove}
          siblingCount={nodes.length}
          siblingIndex={index}
        />
      ))}
    </ul>
  );

  return (
    <div role="tree" aria-label="Categories" className="w-full">
      {renderLevel(tree, 0)}
    </div>
  );
}

export { localizedCategoryName, buildTree };
