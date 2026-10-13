'use client';

import type { AuthoringImageCandidate } from '@/lib/api/types';

type Props = {
  images: AuthoringImageCandidate[];
  onRetryPart: (part: 'text' | 'image', candidateId?: string) => void;
  onAcceptImage?: (candidate: AuthoringImageCandidate) => void;
};

export function AuthoringReviewPanel({ images, onRetryPart, onAcceptImage }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="authoring-review">
      {images.map((image) => (
        <div key={image.id} className="rounded-md border border-slate-200 p-3 text-xs" data-testid="authoring-candidate" data-candidate-status={image.status}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-700">{image.scene_key || 'scene'}</span>
            <span className="text-slate-500">{image.status}</span>
          </div>
          {image.status === 'proposed' && image.url ? <img src={image.url} alt={image.alt_text || 'صورة المنتج المقترحة'} className="mt-2 aspect-[3/2] w-full rounded bg-white object-contain" /> : null}
          {image.foreground_url ? <a className="mt-1 block text-indigo-600" href={image.foreground_url} target="_blank" rel="noreferrer">عرض صورة المنتج الأصلية للمقارنة</a> : null}
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
