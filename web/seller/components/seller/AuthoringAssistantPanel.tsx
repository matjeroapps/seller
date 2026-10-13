'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle, Sparkles, UploadCloud } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/locale-context';
import { sellerApi, ApiError } from '@/lib/api/client';
import type { AuthoringFieldProposal, AuthoringImageCandidate, AuthoringJob } from '@/lib/api/types';
import { AuthoringReviewPanel } from './AuthoringReviewPanel';

const finalStatuses = new Set(['succeeded', 'partial', 'failed']);

type Props = {
  storeId: string;
  brief: string;
  onApplyFields: (fields: AuthoringFieldProposal[]) => void;
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

export function AuthoringAssistantPanel({ storeId, brief, onApplyFields }: Props) {
  const { t } = useTranslation();
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [sourceAssetIds, setSourceAssetIds] = useState<string[]>([]);
  const [requestedImageCount, setRequestedImageCount] = useState(1);
  const [effectiveLimit, setEffectiveLimit] = useState(1);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const [job, setJob] = useState<AuthoringJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartedAt = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const appliedJobIds = useRef(new Set<string>());
  const onApplyFieldsRef = useRef(onApplyFields);
  onApplyFieldsRef.current = onApplyFields;

  const setJobAndApplyFields = useCallback((next: AuthoringJob) => {
    setJob(next);
    const proposed = (next.fields || []).filter((field) => field.status === 'proposed');
    if (proposed.length && !appliedJobIds.current.has(next.id)) {
      appliedJobIds.current.add(next.id);
      onApplyFieldsRef.current(proposed);
    }
  }, []);

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
          setJobAndApplyFields(fresh);
        } catch (err) {
          setError(err instanceof Error ? err.message : t('products.authoring.pollFailed'));
        }
      }, pollDelay(pollStartedAt.current));
    };
    schedule();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [job, storeId, t, setJobAndApplyFields]);

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
        if (presign.mode === 'reuse' && presign.asset) {
          setUploadState(item.id, 'ready');
          setSourceAssetIds((current) =>
            current.includes(presign.asset!.id) ? current : [...current, presign.asset!.id]
          );
          continue;
        }
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
    setCreatingJob(true);
    try {
      const created = await sellerApi.createAuthoringJob(storeId, {
        brief,
        source_asset_ids: sourceAssetIds,
        requested_image_count: requestedImageCount
      }, idempotencyKey());
      pollStartedAt.current = Date.now();
      setJobAndApplyFields(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('products.authoring.createFailed'));
    } finally {
      setCreatingJob(false);
    }
  };

  const retryPart = async (part: 'text' | 'image', candidateId?: string) => {
    if (!job) return;
    try {
      const updated = await sellerApi.retryAuthoringJob(storeId, job.id, candidateId ? { candidate_ids: [candidateId] } : { parts: [part] }, idempotencyKey());
      pollStartedAt.current = Date.now();
      setJobAndApplyFields(updated);
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

  const isJobRunning = Boolean(job && !finalStatuses.has(job.status));
  const isUploading = uploads.some((item) => !['ready', 'error'].includes(item.status));
  const isGenerating = creatingJob || isJobRunning;
  const completedImages = (job?.image_candidates || []).filter((candidate) =>
    ['proposed', 'accepted', 'failed'].includes(candidate.status)
  ).length;
  const imageProgress = job?.image_status === 'processing'
    ? Math.min(completedImages, job.requested_image_count)
    : 0;
  const imageProgressPercent = job && job.requested_image_count > 0
    ? Math.round((imageProgress / job.requested_image_count) * 100)
    : 0;

  return (
    <section className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4 text-xs" data-testid="authoring-assistant">
      <h2 className="text-sm font-semibold text-slate-900">{t('products.authoring.title')}</h2>
      <p className="mt-1 text-slate-600">{t('products.authoring.subtitle')}</p>
      {error ? <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-red-700">{error}</div> : null}
      <div className="mt-3 space-y-2">
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
          className="sr-only"
          aria-label={t('products.authoring.uploadSources')}
          data-testid="authoring-file"
        />
        <div
          role="button"
          tabIndex={0}
          aria-label={t('products.authoring.dropzoneTitle')}
          data-testid="authoring-dropzone"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDraggingFiles(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDraggingFiles(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDraggingFiles(false);
            void uploadFiles(Array.from(event.dataTransfer.files));
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 ${draggingFiles ? 'border-indigo-500 bg-indigo-100' : 'border-indigo-200 bg-white/70 hover:border-indigo-400 hover:bg-white'}`}
        >
          <UploadCloud className="mb-2 h-6 w-6 text-indigo-600" aria-hidden="true" />
          <span className="font-medium text-slate-800">{draggingFiles ? t('products.authoring.dropzoneActive') : t('products.authoring.dropzoneTitle')}</span>
          <span className="mt-1 text-[11px] text-slate-500">{t('products.authoring.dropzoneDescription')}</span>
        </div>
        <ul className="text-[11px] text-slate-500">
          {uploads.map((item) => (
            <li key={item.id} data-testid="authoring-upload-item" data-upload-status={item.status}>
              {item.name} — {t(`products.authoring.uploadStatus.${item.status}`)}
            </li>
          ))}
        </ul>
        {sourceAssetIds.length ? (
          <p className="text-[11px] text-slate-500" data-testid="authoring-source-count">
            {t('products.authoring.selectedImages', `${sourceAssetIds.length} images selected`).replace('{count}', String(sourceAssetIds.length))}
          </p>
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
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded bg-indigo-600 px-3 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          onClick={createJob}
          disabled={isGenerating || isUploading || (!brief.trim() && sourceAssetIds.length === 0)}
          data-testid="authoring-generate"
        >
          {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          {isGenerating ? t('products.authoring.generating') : t('products.authoring.generate')}
        </button>
      </div>
      {job ? (
        <div className="mt-4 space-y-3">
          <div className="rounded bg-white p-2 text-slate-700" data-testid="authoring-status">{`${t('products.authoring.statusPrefix')}: ${job.status} · ${t('products.authoring.textPrefix')} ${job.text_status} · ${t('products.authoring.imagePrefix')} ${job.image_status}`}</div>
          {job.image_status === 'processing' ? (
            <div className="rounded-md border border-indigo-200 bg-white p-3" data-testid="authoring-image-progress" role="status" aria-live="polite">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 font-medium text-indigo-900">
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t('products.authoring.imageGenerating')}
                </span>
                <span className="text-slate-500">{imageProgress} / {job.requested_image_count}</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-indigo-100"
                role="progressbar"
                aria-label={t('products.authoring.imageGenerating')}
                aria-valuemin={0}
                aria-valuemax={job.requested_image_count}
                {...(imageProgress > 0 ? { 'aria-valuenow': imageProgress } : {})}
              >
                <div
                  className={`h-full rounded-full bg-indigo-600 transition-all ${imageProgress === 0 ? 'w-1/3 animate-pulse' : ''}`}
                  style={imageProgress > 0 ? { width: `${imageProgressPercent}%` } : undefined}
                />
              </div>
            </div>
          ) : null}
          {job.text_status === 'failed' ? (
            <button type="button" className="rounded border border-slate-300 bg-white px-2 py-1" onClick={() => retryPart('text')} data-testid="authoring-retry-text">
              {t('products.authoring.retryText')}
            </button>
          ) : null}
          {job.image_status === 'failed' && !(job.image_candidates || []).some((candidate) => candidate.status === 'failed') ? (
            <button type="button" className="rounded border border-slate-300 bg-white px-2 py-1" onClick={() => retryPart('image')} data-testid="authoring-retry-image-branch">
              {t('products.authoring.retryImages')}
            </button>
          ) : null}
          <AuthoringReviewPanel
            images={job.image_candidates || []}
            onRetryPart={retryPart}
            onAcceptImage={acceptImage}
          />
        </div>
      ) : null}
    </section>
  );
}
