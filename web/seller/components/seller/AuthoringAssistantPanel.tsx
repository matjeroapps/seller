'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/lib/i18n/locale-context';
import { sellerApi, ApiError } from '@/lib/api/client';
import type { AuthoringImageCandidate, AuthoringJob } from '@/lib/api/types';
import { AuthoringReviewPanel } from './AuthoringReviewPanel';

const finalStatuses = new Set(['succeeded', 'partial', 'failed']);

type Props = {
  storeId: string;
  onApplyName: (name: string) => void;
  onApplyDescription?: (description: string) => void;
};

type UploadItem = {
  id: string;
  name: string;
  status: 'hashing' | 'creating' | 'uploading' | 'completing' | 'ready' | 'error';
  error?: string;
};

function idempotencyKey() {
  return `ai-authoring-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function pollDelay(startedAt: number) {
  const elapsed = Date.now() - startedAt;
  if (elapsed < 60_000) return 2_000;
  if (elapsed < 180_000) return 3_000;
  return 5_000;
}

async function checksumForFile(file: File): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((part) => part.toString(16).padStart(2, '0'))
    .join('');
}

export function AuthoringAssistantPanel({ storeId, onApplyName, onApplyDescription }: Props) {
  const { t } = useTranslation();
  const [brief, setBrief] = useState('');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [sourceAssetIds, setSourceAssetIds] = useState<string[]>([]);
  const [requestedImageCount, setRequestedImageCount] = useState(1);
  const [effectiveLimit, setEffectiveLimit] = useState(1);
  const [job, setJob] = useState<AuthoringJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartedAt = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof sellerApi.getAuthoringLimits !== 'function') return;
    sellerApi.getAuthoringLimits(storeId)
      .then((limits) => {
        setEffectiveLimit(limits.effective_limit);
        setRequestedImageCount(limits.default_count);
      })
      .catch((err: Error) => setError(err.message));
  }, [storeId]);

  useEffect(() => {
    if (!job || finalStatuses.has(job.status)) return;
    pollStartedAt.current ||= Date.now();
    const schedule = () => {
      timerRef.current = setTimeout(async () => {
        try {
          const fresh = await sellerApi.getAuthoringJob(storeId, job.id);
          setJob(fresh);
        } catch (err) {
          setError(err instanceof Error ? err.message : t('products.authoring.pollFailed'));
        }
      }, pollDelay(pollStartedAt.current));
    };
    schedule();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [job, storeId, t]);

  // uploadFiles runs the canonical three-step upload flow used across the
  // media library: createMediaUpload → storage PUT → completeMediaUpload.
  const uploadFiles = async (files: File[]) => {
    setError(null);
    const next: UploadItem[] = files.map((file) => ({
      id: `${Date.now()}-${file.name}`,
      name: file.name,
      status: 'hashing'
    }));
    setUploads((current) => [...current, ...next]);
    for (const item of next) {
      try {
        const file = files.find((entry) => entry.name === item.name)!;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          throw new Error(t('products.authoring.unsupportedType'));
        }
        const checksum = await checksumForFile(file);
        setUploadState(item.id, 'creating');
        const presign = await sellerApi.createMediaUpload(storeId, {
          client_upload_id: globalThis.crypto?.randomUUID?.() || item.id,
          filename: file.name,
          content_type: file.type,
          size_bytes: file.size,
          checksum_sha256: checksum
        });
        if (!presign.upload_url || !presign.intent_id || !presign.upload_token) {
          throw new Error(t('products.authoring.uploadIncomplete'));
        }
        setUploadState(item.id, 'uploading');
        const response = await fetch(presign.upload_url, {
          method: 'PUT',
          body: file,
          headers: presign.required_headers
        });
        if (!response.ok) {
          throw new Error(t('products.authoring.uploadFailed'));
        }
        setUploadState(item.id, 'completing');
        const asset = await sellerApi.completeMediaUpload(storeId, presign.intent_id, presign.upload_token);
        setUploadState(item.id, 'ready');
        setSourceAssetIds((current) => (current.includes(asset.id) ? current : [...current, asset.id]));
      } catch (err) {
        setUploadState(item.id, 'error');
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  };

  function setUploadState(id: string, status: UploadItem['status']) {
    setUploads((current) => current.map((entry) => (entry.id === id ? { ...entry, status } : entry)));
  }

  const createJob = async () => {
    setError(null);
    try {
      const created = await sellerApi.createAuthoringJob(storeId, {
        brief,
        source_asset_ids: sourceAssetIds,
        requested_image_count: requestedImageCount
      }, idempotencyKey());
      pollStartedAt.current = Date.now();
      setJob(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('products.authoring.createFailed'));
    }
  };

  const retryPart = async (part: 'text' | 'image', candidateId?: string) => {
    if (!job) return;
    try {
      const updated = await sellerApi.retryAuthoringJob(storeId, job.id, candidateId ? { candidate_ids: [candidateId] } : { parts: [part] }, idempotencyKey());
      pollStartedAt.current = Date.now();
      setJob(updated);
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'ai_job_conflict' || err.code === 'ai_job_not_retryable')) setError(err.message);
      else setError(err instanceof Error ? err.message : t('products.authoring.retryFailed'));
    }
  };

  const acceptImage = async (candidate: AuthoringImageCandidate) => {
    if (!job) return;
    try {
      const updated = await sellerApi.acceptAuthoringImage(storeId, job.id, candidate.id, { is_visible: false, alt_text: candidate.scene_key || '' }, idempotencyKey());
      setJob({
        ...job,
        image_candidates: (job.image_candidates || []).map((entry) => (entry.id === updated.id ? updated : entry))
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('products.authoring.acceptFailed'));
    }
  };

  return (
    <section className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4 text-xs" data-testid="authoring-assistant">
      <h2 className="text-sm font-semibold text-slate-900">{t('products.authoring.title')}</h2>
      <p className="mt-1 text-slate-600">{t('products.authoring.subtitle')}</p>
      {error ? <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-red-700">{error}</div> : null}
      <div className="mt-3 space-y-2">
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          className="w-full rounded border border-slate-200 p-2"
          placeholder={t('products.authoring.briefPlaceholder')}
          data-testid="authoring-brief"
        />
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          ref={fileInputRef}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = '';
            void uploadFiles(files);
          }}
          className="w-full rounded border border-slate-200 p-1"
          aria-label={t('products.authoring.uploadSources')}
          data-testid="authoring-file"
        />
        <ul className="text-[11px] text-slate-500">
          {uploads.map((item) => (
            <li key={item.id} data-testid="authoring-upload-item" data-upload-status={item.status}>
              {item.name} — {item.status}
            </li>
          ))}
        </ul>
        {sourceAssetIds.length ? (
          <p className="text-[11px] text-slate-500" data-testid="authoring-source-count">{sourceAssetIds.length}</p>
        ) : null}
        <label className="block text-slate-600">
          {t('products.authoring.imageCount')}
          <input
            type="number"
            min={1}
            max={effectiveLimit}
            value={requestedImageCount}
            onChange={(e) => setRequestedImageCount(Number(e.target.value))}
            className="ml-2 w-20 rounded border border-slate-200 p-1"
            data-testid="authoring-image-count"
          />
          <span className="ml-2">{effectiveLimit}</span>
        </label>
        <button type="button" className="rounded bg-indigo-600 px-3 py-1.5 font-medium text-white" onClick={createJob} data-testid="authoring-generate">
          {t('products.authoring.generate')}
        </button>
      </div>
      {job ? (
        <div className="mt-4 space-y-3">
          <div className="rounded bg-white p-2 text-slate-700" data-testid="authoring-status">{`${t('products.authoring.statusPrefix')}: ${job.status} · ${t('products.authoring.textPrefix')} ${job.text_status} · ${t('products.authoring.imagePrefix')} ${job.image_status}`}</div>
          <AuthoringReviewPanel
            fields={job.fields || []}
            images={job.image_candidates || []}
            onAcceptField={async (field, value) => {
              const updated = await sellerApi.updateAuthoringField(storeId, job.id, field.id, { decision: 'accept', value }, idempotencyKey());
              if (updated.field_key === 'name' && updated.locale === 'en') onApplyName(updated.value);
              if (updated.field_key === 'description' && updated.locale === 'en') onApplyDescription?.(updated.value);
              setJob({ ...job, fields: job.fields.map((item) => (item.id === updated.id ? updated : item)) });
            }}
            onRejectField={async (field) => {
              const updated = await sellerApi.updateAuthoringField(storeId, job.id, field.id, { decision: 'reject', value: field.value }, idempotencyKey());
              setJob({ ...job, fields: job.fields.map((item) => (item.id === updated.id ? updated : item)) });
            }}
            onRetryPart={retryPart}
            onAcceptImage={acceptImage}
          />
        </div>
      ) : null}
    </section>
  );
}
