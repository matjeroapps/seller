'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { FolderTree } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/locale-context';
import type { CategoryStatus, StoreCategory } from '@/lib/api/types';

// CategoryPicker is a hierarchical multi-select for store-scoped categories.
// Categories render as an indented checkbox tree with readable names; non-
// active categories are disabled for NEW selections but stay visible when
// already assigned (preserved-assignment rule). The component is keyboard
// operable via native checkboxes and localized labels.

export interface CategoryPickerProps {
  storeId: string;
  categories: StoreCategory[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  disabled?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
}

interface PickerNode {
  category: StoreCategory;
  children: PickerNode[];
}

function buildPickerTree(categories: StoreCategory[]): PickerNode[] {
  const byId = new Map<string, PickerNode>();
  for (const category of categories) {
    byId.set(category.id, { category, children: [] });
  }
  const roots: PickerNode[] = [];
  for (const node of byId.values()) {
    const parent = node.category.parent_category_id ? byId.get(node.category.parent_category_id) : undefined;
    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (nodes: PickerNode[]) => {
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

function pickerName(category: StoreCategory, locale: string): string {
  const en = category.translations?.en?.name;
  const ar = category.translations?.ar?.name;
  if (locale === 'ar') return ar || en || category.slug;
  return en || ar || category.slug;
}

const badgeStyles: Record<string, string> = {
  inactive: 'bg-amber-100 text-amber-700',
  archived: 'bg-slate-200 text-slate-600'
};

export function CategoryPicker({
  storeId,
  categories,
  selectedIds,
  onChange,
  disabled,
  loadError,
  onRetry
}: CategoryPickerProps) {
  const { t, locale } = useTranslation();
  const tree = useMemo(() => buildPickerTree(categories), [categories]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    onChange(Array.from(next));
  };

  if (loadError) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
        <p>{loadError}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 font-medium underline hover:no-underline"
          >
            {t('errors.retry', 'Try again')}
          </button>
        )}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
        <p className="flex items-center gap-2 font-medium text-slate-700">
          <FolderTree className="h-4 w-4 text-slate-400" aria-hidden="true" />
          {t('categories.pickerEmptyTitle', 'No store categories yet')}
        </p>
        <p className="mt-1 text-slate-500">{t('categories.pickerEmptyBody', 'Create categories first, then assign them to this product.')}</p>
        <Link
          href={`/dashboard/stores/${storeId}/catalog/categories`}
          className="mt-2 inline-block font-medium text-indigo-600 hover:text-indigo-700"
        >
          {t('categories.pickerEmptyLink', 'Manage categories')}
        </Link>
      </div>
    );
  }

  const renderNode = (node: PickerNode, depth: number): React.ReactNode => {
    const { category } = node;
    const status = category.status as CategoryStatus;
    const isSelected = selected.has(category.id);
    const lockSelection = disabled || (!isSelected && status !== 'active');
    const name = pickerName(category, locale);
    const inputId = `category-picker-${category.id}`;

    return (
      <li key={category.id} className="list-none">
        <div className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-50" style={{ paddingInlineStart: `${depth * 20}px` }}>
          <input
            id={inputId}
            type="checkbox"
            checked={isSelected}
            disabled={lockSelection}
            onChange={(event) => toggle(category.id, event.target.checked)}
            aria-label={name}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor={inputId} className="flex min-w-0 cursor-pointer items-center gap-2 text-sm text-slate-700">
            <span className="truncate">{name}</span>
            {status !== 'active' && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badgeStyles[status] ?? ''}`}>
                {t(`categories.status${status.charAt(0).toUpperCase()}${status.slice(1)}`, status)}
              </span>
            )}
          </label>
        </div>
        {node.children.length > 0 && (
          // Nested <ul> keeps the list markup valid: an <li> must not be a
          // direct child of another <li> (React DOM/hydration warning).
          <ul role="group" className="space-y-0.5">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <fieldset className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 p-2" disabled={disabled}>
      <legend className="sr-only">{t('categories.pickerLabel', 'Categories')}</legend>
      <ul className="space-y-0.5">
        {tree.map((node) => renderNode(node, 0))}
      </ul>
      <p className="mt-2 px-1 text-[11px] text-slate-500">{t('categories.pickerHint', 'Select one or more active categories.')}</p>
    </fieldset>
  );
}
