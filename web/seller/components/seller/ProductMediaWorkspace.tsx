'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileImage,
  Image as ImageIcon,
  LoaderCircle,
  RefreshCw,
  Search,
  Star,
  Trash2,
  UploadCloud,
  X
} from 'lucide-react';
import { ConfirmModal } from '@/components/seller/ConfirmModal';
import { sellerApi } from '@/lib/api/client';
import type { ProductMediaReference, StoreMediaAsset } from '@/lib/api/types';

const PAGE_SIZE = 12;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type UploadItem = {
  id: string;
  file: File;
  preview: string;
  status: 'queued' | 'hashing' | 'uploading' | 'completing' | 'success' | 'error';
  progress: number;
  error?: string;
  asset?: StoreMediaAsset;
};

type ProductMediaWorkspaceProps = {
  storeId: string;
  productId: string;
  productName: string;
  canManage: boolean;
  initialAssets: StoreMediaAsset[];
  initialReferences: ProductMediaReference[];
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

type LegacyMediaShape = StoreMediaAsset & {
  file_name?: string;
  mime_type?: string;
  size_bytes?: number;
};

function mediaFilename(asset: StoreMediaAsset) {
  const legacy = asset as LegacyMediaShape;
  return asset.original_filename || legacy.file_name || 'Media asset';
}

function mediaType(asset: StoreMediaAsset) {
  const legacy = asset as LegacyMediaShape;
  return asset.content_type || legacy.mime_type || 'image/*';
}

function mediaBytes(asset: StoreMediaAsset) {
  const legacy = asset as LegacyMediaShape;
  return asset.byte_size || legacy.size_bytes || 0;
}

function makeUploadItem(file: File): UploadItem {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    file,
    preview: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '',
    status: 'queued',
    progress: 0
  };
}

async function checksumSha256(file: File) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('This browser cannot securely verify the upload checksum.');
  }
  const hash = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(hash))
    .map((part) => part.toString(16).padStart(2, '0'))
    .join('');
}

function uploadWithProgress(
  url: string,
  file: File,
  headers: Record<string, string> | undefined,
  onProgress: (progress: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    Object.entries(headers || {}).forEach(([key, value]) => request.setRequestHeader(key, value));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error('The image upload could not reach storage.'));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`Storage upload failed with HTTP ${request.status}.`));
    };
    request.send(file);
  });
}

export function ProductMediaWorkspace({
  storeId,
  productId,
  productName,
  canManage,
  initialAssets,
  initialReferences
}: ProductMediaWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<StoreMediaAsset[]>(initialAssets);
  const [references, setReferences] = useState<ProductMediaReference[]>(initialReferences);
  const [assetSearch, setAssetSearch] = useState('');
  const [assetType, setAssetType] = useState('');
  const [assetAttachment, setAssetAttachment] = useState<'all' | 'attached' | 'unattached'>('all');
  const [assetPage, setAssetPage] = useState(0);
  const [assetTotal, setAssetTotal] = useState(initialAssets.length);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [referenceWorkingId, setReferenceWorkingId] = useState<string | null>(null);
  const [editingAltId, setEditingAltId] = useState<string | null>(null);
  const [altDraft, setAltDraft] = useState('');
  const [detachId, setDetachId] = useState<string | null>(null);
  const [detaching, setDetaching] = useState(false);

  useEffect(() => {
    setAssets(initialAssets);
    setAssetTotal(initialAssets.length);
  }, [initialAssets]);

  useEffect(() => {
    setReferences(initialReferences);
  }, [initialReferences]);

  const attachedAssetIds = useMemo(() => new Set(references.map((reference) => reference.asset_id)), [references]);

  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    setAssetsError(null);
    try {
      const response = await sellerApi.listStoreMedia(storeId, {
        filename: assetSearch,
        contentType: assetType,
        limit: PAGE_SIZE,
        offset: assetPage * PAGE_SIZE
      });
      setAssets(response.items || []);
      setAssetTotal(response.total ?? response.items?.length ?? 0);
    } catch (error) {
      setAssetsError(errorMessage(error, 'Unable to load the store media library.'));
    } finally {
      setAssetsLoading(false);
    }
  }, [assetPage, assetSearch, assetType, storeId]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const visibleAssets = useMemo(() => {
    if (assetAttachment === 'all') return assets;
    return assets.filter((asset) =>
      assetAttachment === 'attached' ? attachedAssetIds.has(asset.id) : !attachedAssetIds.has(asset.id)
    );
  }, [assetAttachment, assets, attachedAssetIds]);

  const setUploadState = (id: string, patch: Partial<UploadItem>) => {
    setUploadItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const uploadOne = async (item: UploadItem) => {
    try {
      setUploadState(item.id, { status: 'hashing', progress: 5, error: undefined });
      const checksum = await checksumSha256(item.file);
      const presign = await sellerApi.createMediaUpload(storeId, {
        client_upload_id: globalThis.crypto?.randomUUID?.() || item.id,
        filename: item.file.name,
        content_type: item.file.type,
        size_bytes: item.file.size,
        checksum_sha256: checksum
      });

      if (presign.mode === 'reuse' && presign.asset) {
        setUploadState(item.id, { status: 'success', progress: 100, asset: presign.asset });
        setAssets((current) => [presign.asset!, ...current.filter((asset) => asset.id !== presign.asset!.id)]);
        setAssetTotal((total) => total + (assets.some((asset) => asset.id === presign.asset!.id) ? 0 : 1));
        setSelectedAssetIds((current) =>
          current.includes(presign.asset!.id) ? current : [...current, presign.asset!.id]
        );
        return;
      }

      if (!presign.upload_url || !presign.intent_id || !presign.upload_token) {
        throw new Error('The upload service returned an incomplete upload instruction.');
      }

      setUploadState(item.id, { status: 'uploading', progress: 10 });
      await uploadWithProgress(presign.upload_url, item.file, presign.required_headers, (progress) =>
        setUploadState(item.id, { progress: Math.max(10, Math.round(progress * 0.85)) })
      );
      setUploadState(item.id, { status: 'completing', progress: 95 });
      const asset = await sellerApi.completeMediaUpload(storeId, presign.intent_id, presign.upload_token);
      setUploadState(item.id, { status: 'success', progress: 100, asset });
      setAssets((current) => [asset, ...current.filter((entry) => entry.id !== asset.id)]);
      setAssetTotal((total) => total + (assets.some((entry) => entry.id === asset.id) ? 0 : 1));
      setSelectedAssetIds((current) => (current.includes(asset.id) ? current : [...current, asset.id]));
    } catch (error) {
      setUploadState(item.id, {
        status: 'error',
        progress: 0,
        error: errorMessage(error, 'This image could not be uploaded.')
      });
    }
  };

  const retryUpload = async (itemId: string) => {
    const item = uploadItems.find((entry) => entry.id === itemId);
    if (!item || uploading) return;
    setActionError(null);
    setNotice(null);
    setUploading(true);
    await uploadOne(item);
    setUploading(false);
    await loadAssets();
  };

  const queueFiles = async (fileList: FileList | File[]) => {
    if (!canManage || uploading) return;
    const candidates = Array.from(fileList);
    const valid: UploadItem[] = [];
    const invalidMessages: string[] = [];

    candidates.forEach((file) => {
      if (!ALLOWED_TYPES.has(file.type)) {
        invalidMessages.push(`${file.name}: use JPG, PNG, or WebP.`);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        invalidMessages.push(`${file.name}: maximum size is 10 MB.`);
        return;
      }
      valid.push(makeUploadItem(file));
    });

    if (invalidMessages.length) setActionError(invalidMessages.join(' '));
    if (!valid.length) return;

    setActionError(null);
    setNotice(null);
    setUploadItems((current) => [...current, ...valid]);
    setUploading(true);
    for (const item of valid) {
      await uploadOne(item);
    }
    setUploading(false);
    setNotice('Upload processing finished. Uploaded images are selected and ready to attach.');
    await loadAssets();
  };

  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) await queueFiles(event.target.files);
    event.target.value = '';
  };

  const toggleAsset = (assetId: string) => {
    setSelectedAssetIds((current) =>
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]
    );
  };

  const handleAttachSelected = async () => {
    if (!canManage || attaching || !selectedAssetIds.length) return;
    const ids = selectedAssetIds.filter((id) => !attachedAssetIds.has(id));
    if (!ids.length) {
      setActionError('All selected images are already attached to this product.');
      return;
    }
    setAttaching(true);
    setActionError(null);
    setNotice(null);
    const added: ProductMediaReference[] = [];
    const failures: string[] = [];
    for (const [index, assetId] of ids.entries()) {
      try {
        const reference = await sellerApi.attachProductMedia(storeId, productId, {
          asset_id: assetId,
          sort_order: references.length + index,
          is_primary: references.length === 0 && index === 0
        });
        added.push(reference);
      } catch (error) {
        failures.push(errorMessage(error, `Could not attach ${assetId}.`));
      }
    }
    setReferences((current) => [...current, ...added]);
    setSelectedAssetIds([]);
    setAttaching(false);
    if (failures.length) setActionError(`Some images were not attached. ${failures.join(' ')}`);
    else setNotice(`${added.length} image${added.length === 1 ? '' : 's'} attached.`);
  };

  const reloadReferences = async () => {
    const response = await sellerApi.listProductMediaReferences(storeId, productId);
    setReferences(response.items || []);
  };

  const updateReference = async (reference: ProductMediaReference, patch: { alt_text?: string; sort_order?: number; is_primary?: boolean }) => {
    setReferenceWorkingId(reference.id);
    setActionError(null);
    try {
      await sellerApi.updateProductMediaReference(storeId, productId, reference.id, {
        alt_text: patch.alt_text ?? reference.alt_text,
        sort_order: patch.sort_order ?? reference.sort_order,
        is_primary: patch.is_primary ?? reference.is_primary
      });
      await reloadReferences();
      setNotice('Product media updated.');
    } catch (error) {
      setActionError(errorMessage(error, 'Could not update this media reference.'));
    } finally {
      setReferenceWorkingId(null);
    }
  };

  const moveReference = async (referenceId: string, direction: -1 | 1) => {
    const ordered = [...references].sort((a, b) => a.sort_order - b.sort_order);
    const index = ordered.findIndex((reference) => reference.id === referenceId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
    setReferenceWorkingId(referenceId);
    setActionError(null);
    try {
      await Promise.all(
        ordered.map((reference, sortOrder) =>
          sellerApi.updateProductMediaReference(storeId, productId, reference.id, {
            alt_text: reference.alt_text,
            sort_order: sortOrder,
            is_primary: reference.is_primary
          })
        )
      );
      await reloadReferences();
      setNotice('Display order updated.');
    } catch (error) {
      setActionError(errorMessage(error, 'Could not update the display order.'));
    } finally {
      setReferenceWorkingId(null);
    }
  };

  const confirmDetach = async () => {
    if (!detachId) return;
    setDetaching(true);
    setActionError(null);
    try {
      await sellerApi.detachProductMedia(storeId, productId, detachId);
      setReferences((current) => current.filter((reference) => reference.id !== detachId));
      setDetachId(null);
      setNotice('Image detached from this product. The store media asset was kept.');
    } catch (error) {
      setActionError(errorMessage(error, 'Could not detach this image.'));
    } finally {
      setDetaching(false);
    }
  };

  const clearUploadItem = (id: string) => {
    setUploadItems((current) => {
      const item = current.find((entry) => entry.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return current.filter((entry) => entry.id !== id);
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="product-media-heading">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="product-media-heading" className="text-base font-bold text-slate-950">
            Product media workspace
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Upload, search, select, and arrange the images used by {productName}.
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-500">{references.length} attached</span>
      </div>

      {(actionError || assetsError) && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{actionError || assetsError}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div
        role="button"
        tabIndex={canManage ? 0 : -1}
        aria-disabled={!canManage}
        aria-label="Upload product images"
        className={`mt-5 rounded-xl border-2 border-dashed p-6 text-center transition ${
          dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50'
        } ${canManage ? 'cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/60' : 'cursor-not-allowed opacity-60'}`}
        onClick={() => canManage && fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (canManage && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (canManage) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={async (event) => {
          event.preventDefault();
          setDragActive(false);
          if (canManage) await queueFiles(event.dataTransfer.files);
        }}
      >
        <UploadCloud className="mx-auto h-8 w-8 text-indigo-500" />
        <p className="mt-2 text-sm font-semibold text-slate-900">Drop images here or choose files</p>
        <p className="mt-1 text-xs text-slate-500">JPG, PNG, or WebP up to 10 MB each. Multiple files supported.</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={handleFileInput}
          disabled={!canManage || uploading}
          aria-label="Choose product image files"
        />
      </div>

      {uploadItems.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3" aria-live="polite">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900">Upload queue</h3>
            {uploading && <LoaderCircle className="h-4 w-4 animate-spin text-indigo-600" />}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {uploadItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-slate-100">
                  {item.preview ? <img src={item.preview} alt="" className="h-full w-full object-cover" /> : <FileImage className="m-3 h-6 w-6 text-slate-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-slate-800">{item.file.name}</div>
                  <div className="text-[10px] text-slate-500">{item.status === 'error' ? item.error : `${item.status} · ${item.progress}%`}</div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-200">
                    <div className={`h-full ${item.status === 'error' ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${item.progress}%` }} />
                  </div>
                </div>
                {item.status === 'error' && !uploading && (
                  <button
                    type="button"
                    onClick={() => void retryUpload(item.id)}
                    className="rounded border border-indigo-200 px-2 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50"
                  >
                    Retry
                  </button>
                )}
                {!uploading && (
                  <button type="button" onClick={() => clearUploadItem(item.id)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Remove ${item.file.name} from upload queue`}>
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400 rtl:left-auto rtl:right-3" />
          <input
            value={assetSearch}
            onChange={(event) => {
              setAssetPage(0);
              setAssetSearch(event.target.value);
            }}
            placeholder="Search uploaded images by filename..."
            aria-label="Search store media"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rtl:pl-3 rtl:pr-9"
          />
        </div>
        <select
          value={assetType}
          onChange={(event) => {
            setAssetPage(0);
            setAssetType(event.target.value);
          }}
          aria-label="Filter media type"
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
        >
          <option value="">All image types</option>
          <option value="image/jpeg">JPEG</option>
          <option value="image/png">PNG</option>
          <option value="image/webp">WebP</option>
        </select>
        <select
          value={assetAttachment}
          onChange={(event) => setAssetAttachment(event.target.value as typeof assetAttachment)}
          aria-label="Filter attachment status"
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
        >
          <option value="all">All assets</option>
          <option value="attached">Attached</option>
          <option value="unattached">Unattached</option>
        </select>
        <button type="button" onClick={() => void loadAssets()} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" aria-label="Refresh media library">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Store media library</h3>
        <button
          type="button"
          onClick={() => void handleAttachSelected()}
          disabled={!canManage || attaching || selectedAssetIds.length === 0}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {attaching ? 'Attaching...' : `Attach selected${selectedAssetIds.length ? ` (${selectedAssetIds.length})` : ''}`}
        </button>
      </div>

      {assetsLoading ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-8 text-center text-xs text-slate-500"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading media library...</div>
      ) : visibleAssets.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs text-slate-500">
          <ImageIcon className="mx-auto mb-2 h-7 w-7 text-slate-300" />
          {assets.length === 0 ? 'No uploaded images found yet.' : 'No images match the current search or filter.'}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {visibleAssets.map((asset) => {
            const selected = selectedAssetIds.includes(asset.id);
            const attached = attachedAssetIds.has(asset.id);
            return (
              <button
                key={asset.id}
                type="button"
                aria-pressed={selected}
                onClick={() => canManage && toggleAsset(asset.id)}
                className={`group text-left rounded-xl border p-2 transition ${selected ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200 bg-white hover:border-indigo-300'} ${!canManage ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                  {asset.url ? <img src={asset.url} alt={mediaFilename(asset)} className="h-full w-full object-cover" /> : <ImageIcon className="h-8 w-8 text-slate-300" />}
                  <span className={`absolute right-2 top-2 rounded-full p-1 ${selected ? 'bg-indigo-600 text-white' : 'bg-white/90 text-slate-400'}`} aria-hidden="true">
                    {selected ? <Check className="h-3.5 w-3.5" /> : <PlusIcon />}
                  </span>
                  {attached && <span className="absolute bottom-2 left-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">Attached</span>}
                </div>
                <div className="mt-2 truncate text-xs font-semibold text-slate-800" title={mediaFilename(asset)}>{mediaFilename(asset)}</div>
                <div className="mt-1 flex justify-between gap-2 text-[10px] text-slate-500">
                  <span>{mediaType(asset).replace('image/', '').toUpperCase()}</span>
                  <span>{formatBytes(mediaBytes(asset))}</span>
                </div>
                <div className="mt-1 text-[10px] text-slate-400">{formatDate(asset.created_at)}</div>
              </button>
            );
          })}
        </div>
      )}

      {assetTotal > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {assetPage * PAGE_SIZE + 1}–{Math.min((assetPage + 1) * PAGE_SIZE, assetTotal)} of {assetTotal}</span>
          <div className="flex gap-2">
            <button type="button" disabled={assetPage === 0} onClick={() => setAssetPage((page) => page - 1)} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40">Previous</button>
            <button type="button" disabled={(assetPage + 1) * PAGE_SIZE >= assetTotal} onClick={() => setAssetPage((page) => page + 1)} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      <div className="mt-8 border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Attached product media</h3>
            <p className="mt-1 text-xs text-slate-500">Detach only removes the product reference; the store asset remains available.</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">{references.length} images</span>
        </div>
        {references.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs text-slate-500">No images are attached to this product yet.</div>
        ) : (
          <div className="mt-4 space-y-3">
            {[...references].sort((a, b) => a.sort_order - b.sort_order).map((reference, index, ordered) => (
              <div key={reference.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-200">
                  {reference.url ? <img src={reference.url} alt={reference.alt_text || productName} className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-slate-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">Image {index + 1}</span>
                    {reference.is_primary && <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800"><Star className="h-3 w-3" /> Primary</span>}
                  </div>
                  {editingAltId === reference.id ? (
                    <div className="mt-2 flex gap-2">
                      <input value={altDraft} onChange={(event) => setAltDraft(event.target.value)} aria-label={`Alt text for image ${index + 1}`} className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-xs" />
                      <button type="button" onClick={() => { void updateReference(reference, { alt_text: altDraft }); setEditingAltId(null); }} className="rounded bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white">Save</button>
                    </div>
                  ) : (
                    <button type="button" disabled={!canManage} onClick={() => { setEditingAltId(reference.id); setAltDraft(reference.alt_text || ''); }} className="mt-1 block max-w-full truncate text-left text-xs text-slate-500 hover:text-indigo-600">
                      Alt text: {reference.alt_text || 'Add descriptive alt text'}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {!reference.is_primary && <button type="button" disabled={!canManage || referenceWorkingId === reference.id} onClick={() => void updateReference(reference, { is_primary: true })} className="rounded border border-amber-200 px-2 py-1 text-[10px] font-semibold text-amber-700 hover:bg-amber-50">Set primary</button>}
                  <button type="button" disabled={!canManage || index === 0 || referenceWorkingId === reference.id} onClick={() => void moveReference(reference.id, -1)} aria-label={`Move image ${index + 1} up`} className="rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-white disabled:opacity-40"><ChevronUp className="h-3.5 w-3.5" /></button>
                  <button type="button" disabled={!canManage || index === ordered.length - 1 || referenceWorkingId === reference.id} onClick={() => void moveReference(reference.id, 1)} aria-label={`Move image ${index + 1} down`} className="rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-white disabled:opacity-40"><ChevronDown className="h-3.5 w-3.5" /></button>
                  <button type="button" disabled={!canManage || referenceWorkingId === reference.id} onClick={() => setDetachId(reference.id)} aria-label={`Detach image ${index + 1}`} title="Detach reference" className="rounded border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(detachId)}
        title="Detach product image"
        description="This removes the image from this product only. The original asset will remain in the store media library."
        confirmLabel="Detach image"
        cancelLabel="Keep image"
        variant="danger"
        loading={detaching}
        onConfirm={() => void confirmDetach()}
        onCancel={() => setDetachId(null)}
      />
    </section>
  );
}

function PlusIcon() {
  return <span className="text-sm leading-none">+</span>;
}
