'use client';

import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';

export interface PropertyDraft {
  code: string;
  nameAr: string;
  nameEn: string;
}

export interface PropertyValueDraft extends PropertyDraft {
  attributeId: string;
}

export interface PropertySelectionOption {
  id: string;
  name: string;
  values: Array<{ id: string; code: string; name: string; status?: string }>;
}

export interface PropertySelectionStepProps {
  properties: PropertySelectionOption[];
  selected: Record<string, string[]>;
  onToggleProperty: (propertyId: string, selected: boolean) => void;
  onToggleValue: (propertyId: string, valueId: string) => void;
  onCreateProperty?: (draft: PropertyDraft) => Promise<void> | void;
  onCreatePropertyValue?: (draft: PropertyValueDraft) => Promise<void> | void;
  disabled?: boolean;
}

export function PropertySelectionStep({
  properties,
  selected,
  onToggleProperty,
  onToggleValue,
  onCreateProperty,
  onCreatePropertyValue,
  disabled = false,
}: PropertySelectionStepProps) {
  const [creatingProperty, setCreatingProperty] = useState(false);
  const [creatingValueFor, setCreatingValueFor] = useState<string | null>(null);
  const [draft, setDraft] = useState<PropertyDraft>({ code: '', nameAr: '', nameEn: '' });
  const [valueDraft, setValueDraft] = useState<PropertyValueDraft>({ attributeId: '', code: '', nameAr: '', nameEn: '' });
  const submitProperty = async (event: FormEvent) => {
    event.preventDefault();
    if (!onCreateProperty || !draft.code.trim() || (!draft.nameAr.trim() && !draft.nameEn.trim())) return;
    await onCreateProperty({ code: draft.code.trim(), nameAr: draft.nameAr.trim(), nameEn: draft.nameEn.trim() });
    setDraft({ code: '', nameAr: '', nameEn: '' });
    setCreatingProperty(false);
  };
  const submitValue = async (event: FormEvent) => {
    event.preventDefault();
    if (!onCreatePropertyValue || !valueDraft.attributeId || !valueDraft.code.trim() || (!valueDraft.nameAr.trim() && !valueDraft.nameEn.trim())) return;
    await onCreatePropertyValue({ ...valueDraft, code: valueDraft.code.trim(), nameAr: valueDraft.nameAr.trim(), nameEn: valueDraft.nameEn.trim() });
    setValueDraft({ attributeId: '', code: '', nameAr: '', nameEn: '' });
    setCreatingValueFor(null);
  };
  return (
    <section className="rounded-xl border border-slate-100 bg-slate-50/50 p-4" data-testid="variant-attribute-picker">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">١. خصائص وقيم المنتج</h3>
          <p className="mt-1 text-xs text-slate-500">اختر خاصية واحدة أو أكثر ثم حدد القيم المتاحة.</p>
        </div>
        {onCreateProperty && (
          <button type="button" onClick={() => setCreatingProperty((value) => !value)} disabled={disabled} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" /> إضافة خاصية
          </button>
        )}
      </div>
      {creatingProperty && onCreateProperty && (
        <form onSubmit={submitProperty} className="mt-3 grid gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 sm:grid-cols-4" data-testid="create-property-form">
          <input aria-label="رمز الخاصية" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} placeholder="code" className="rounded border border-slate-200 px-2 py-1 text-xs" />
          <input aria-label="اسم الخاصية بالعربية" value={draft.nameAr} onChange={(event) => setDraft({ ...draft, nameAr: event.target.value })} placeholder="الاسم بالعربية" className="rounded border border-slate-200 px-2 py-1 text-xs" dir="rtl" />
          <input aria-label="اسم الخاصية بالإنجليزية" value={draft.nameEn} onChange={(event) => setDraft({ ...draft, nameEn: event.target.value })} placeholder="English name" className="rounded border border-slate-200 px-2 py-1 text-xs" />
          <button type="submit" disabled={disabled} className="rounded bg-emerald-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">حفظ الخاصية</button>
        </form>
      )}
      <div className="mt-3 space-y-3">
        {properties.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-500">لا توجد خصائص متاحة لهذا المتجر.</p>
        ) : properties.map((property) => {
          const values = selected[property.id] || [];
          return (
            <div key={property.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input type="checkbox" aria-label={`Use ${property.name}`} checked={selected[property.id] !== undefined} disabled={disabled} onChange={(event) => onToggleProperty(property.id, event.target.checked)} />
                {property.name}
                </label>
                {onCreatePropertyValue && selected[property.id] !== undefined && (
                  <button type="button" onClick={() => { setCreatingValueFor(creatingValueFor === property.id ? null : property.id); setValueDraft({ attributeId: property.id, code: '', nameAr: '', nameEn: '' }); }} disabled={disabled} className="text-[11px] font-semibold text-emerald-700">+ قيمة</button>
                )}
              </div>
              {creatingValueFor === property.id && onCreatePropertyValue && (
                <form onSubmit={submitValue} className="mt-2 grid gap-2 rounded border border-emerald-100 bg-emerald-50/40 p-2 sm:grid-cols-4" data-testid={`create-value-form-${property.id}`}>
                  <input aria-label="رمز القيمة" value={valueDraft.code} onChange={(event) => setValueDraft({ ...valueDraft, code: event.target.value })} placeholder="code" className="rounded border border-slate-200 px-2 py-1 text-xs" />
                  <input aria-label="اسم القيمة بالعربية" value={valueDraft.nameAr} onChange={(event) => setValueDraft({ ...valueDraft, nameAr: event.target.value })} placeholder="العربية" className="rounded border border-slate-200 px-2 py-1 text-xs" dir="rtl" />
                  <input aria-label="اسم القيمة بالإنجليزية" value={valueDraft.nameEn} onChange={(event) => setValueDraft({ ...valueDraft, nameEn: event.target.value })} placeholder="English" className="rounded border border-slate-200 px-2 py-1 text-xs" />
                  <button type="submit" disabled={disabled} className="rounded bg-emerald-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">حفظ القيمة</button>
                </form>
              )}
              {selected[property.id] !== undefined && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {property.values.map((value) => (
                    <label key={value.id} className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${values.includes(value.id) ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600'}`}>
                      <input type="checkbox" aria-label={`${property.name}: ${value.name}`} checked={values.includes(value.id)} disabled={disabled} onChange={() => onToggleValue(property.id, value.id)} />
                      {value.name || value.code}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
