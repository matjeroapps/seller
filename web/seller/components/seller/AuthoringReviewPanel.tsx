'use client';

import type { AuthoringFieldProposal, AuthoringImageCandidate } from '@/lib/api/types';

type Props = {
  fields: AuthoringFieldProposal[];
  images: AuthoringImageCandidate[];
  onAcceptField: (field: AuthoringFieldProposal, value: string) => void;
  onRejectField: (field: AuthoringFieldProposal) => void;
  onRetryPart: (part: 'text' | 'image', candidateId?: string) => void;
  onAcceptImage?: (candidate: AuthoringImageCandidate) => void;
};

export function AuthoringReviewPanel({ fields, images, onAcceptField, onRejectField, onRetryPart, onAcceptImage }: Props) {
  return (
    <div className="space-y-3" data-testid="authoring-review">
      {fields.map((field) => (
        <div key={field.id} className="rounded-md border border-slate-200 p-3 text-xs" data-testid="authoring-field">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-700">{field.field_key} · {field.locale}</span>
            <span className="text-slate-500">{field.status}</span>
          </div>
          {field.failure_code ? <p className="mt-1 text-red-600">{field.failure_code}</p> : null}
          <textarea
            defaultValue={field.value}
            data-field-id={field.id}
            className="mt-2 w-full rounded border border-slate-200 p-2 text-xs"
            onBlur={(event) => {
              field.value = event.currentTarget.value;
            }}
          />
          <div className="mt-2 flex gap-2">
            <button type="button" className="rounded bg-emerald-600 px-2 py-1 text-white" onClick={() => onAcceptField(field, field.value)} disabled={field.status !== 'proposed'} data-testid="authoring-accept-field">
              اعتماد
            </button>
            <button type="button" className="rounded border px-2 py-1" onClick={() => onRejectField(field)} disabled={field.status !== 'proposed'} data-testid="authoring-reject-field">
              رفض
            </button>
            {field.status === 'failed' ? (
              <button type="button" className="rounded border px-2 py-1" onClick={() => onRetryPart('text')} data-testid="authoring-retry-text">
                إعادة محاولة النص
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {images.map((image) => (
        <div key={image.id} className="rounded-md border border-slate-200 p-3 text-xs" data-testid="authoring-candidate" data-candidate-status={image.status}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-700">{image.scene_key || 'scene'}</span>
            <span className="text-slate-500">{image.status}</span>
          </div>
          {image.url ? <img src={image.url} alt={image.alt_text || 'AI candidate'} className="mt-2 max-h-40 rounded object-contain" /> : null}
          {image.foreground_url ? <a className="mt-1 block text-indigo-600" href={image.foreground_url}>foreground</a> : null}
          {image.failure_code ? <p className="mt-1 text-red-600">{image.failure_code}</p> : null}
          <div className="mt-2 flex gap-2">
            {image.status === 'proposed' && onAcceptImage ? (
              <button
                type="button"
                className="rounded bg-indigo-600 px-2 py-1 text-white"
                onClick={() => onAcceptImage(image)}
                disabled={!image.url}
                data-testid="authoring-accept-image"
              >
                اعتماد الصورة
              </button>
            ) : null}
            {image.status === 'failed' ? (
              <button type="button" className="rounded border px-2 py-1" onClick={() => onRetryPart('image', image.id)} data-testid="authoring-retry-image">
                إعادة محاولة الصورة
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
