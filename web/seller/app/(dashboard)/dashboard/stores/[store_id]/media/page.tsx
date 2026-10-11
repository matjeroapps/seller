'use client';

import { useEffect, useState, use } from 'react';
import { Image as ImageIcon, Upload, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { ConfirmModal } from '@/components/seller/ConfirmModal';
import { useTranslation } from '@/lib/i18n/locale-context';
import { sellerApi } from '@/lib/api/client';
import type { StoreMediaAsset } from '@/lib/api/types';

export default function StoreMediaLibraryPage({
  params
}: {
  params: Promise<{ store_id: string }> | { store_id: string };
}) {
  const unwrappedParams =
    params && typeof (params as unknown as Promise<{ store_id: string }>).then === 'function'
      ? use(params as Promise<{ store_id: string }>)
      : (params as unknown as { store_id: string }) || {};
  const { store_id } = unwrappedParams;
  const { t } = useTranslation();

  const [assets, setAssets] = useState<StoreMediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string>('');

  const loadMedia = () => {
    setLoading(true);
    setActionError(null);
    sellerApi
      .listStoreMedia(store_id)
      .then((res) => {
        setAssets(res.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadMedia();
  }, [store_id]);

  // Compute SHA-256 digest hex using Web Crypto API
  async function computeSha256(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus(t('media.statusChecksum'));

    try {
      const checksum = await computeSha256(file);
      const clientUploadId = crypto.randomUUID();

      setUploadStatus(t('media.statusPresigning'));
      const presign = await sellerApi.createMediaUpload(store_id, {
        client_upload_id: clientUploadId,
        filename: file.name,
        content_type: file.type || 'image/jpeg',
        size_bytes: file.size,
        checksum_sha256: checksum
      });

      if (presign.mode === 'reuse' && presign.asset) {
        setUploadStatus(t('media.statusReused'));
        loadMedia();
        return;
      }

      if (presign.mode === 'upload' && presign.upload_url && presign.intent_id && presign.upload_token) {
        setUploadStatus(t('media.statusUploading'));
        const headers: Record<string, string> = {
          ...presign.required_headers
        };

        const uploadRes = await fetch(presign.upload_url, {
          method: 'PUT',
          headers,
          body: file
        });

        if (!uploadRes.ok) {
          throw new Error(t('media.storageUploadFailed').replace('{status}', String(uploadRes.status)));
        }

        setUploadStatus(t('media.statusVerifying'));
        await sellerApi.completeMediaUpload(store_id, presign.intent_id, presign.upload_token);
        setUploadStatus(t('media.statusComplete'));
        loadMedia();
      }
    } catch (err: any) {
      setActionError(err.message || t('media.uploadFailed'));
    } finally {
      setUploading(false);
      setUploadStatus('');
      e.target.value = '';
    }
  };

  const handleDelete = (assetId: string) => {
    setDeletingAssetId(assetId);
  };

  const confirmDelete = async () => {
    if (!deletingAssetId) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await sellerApi.deleteStoreMedia(store_id, deletingAssetId);
      setDeletingAssetId(null);
      loadMedia();
    } catch (err: any) {
      const isConflict =
        err?.status === 409 ||
        err?.code === 'media_in_use' ||
        err?.code === 'conflict' ||
        err?.message?.toLowerCase().includes('in use') ||
        err?.message?.toLowerCase().includes('referenced');
      if (isConflict) {
        setConflictMessage(err.message || t('media.conflictFallback'));
        setDeletingAssetId(null);
        setConflictModalOpen(true);
      } else {
        setActionError(err.message || t('media.deleteFailed'));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('media.title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{t('media.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> {t('media.uploadMedia')}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {uploadStatus && (
        <div className="p-3 bg-sky-50 border border-sky-200 text-sky-800 text-xs font-medium rounded-md flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {uploadStatus}
        </div>
      )}

      {/* Assets Grid */}
      {loading ? (
        <div className="p-6 text-sm text-slate-500 animate-pulse">{t('media.loading')}</div>
      ) : assets.length === 0 ? (
        <div className="p-8 bg-white border border-slate-200 rounded-lg text-center text-xs text-slate-500">
          <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          {t('media.emptyBody')}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map((asset) => (
            <div key={asset.id} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm space-y-2">
              <div className="h-36 bg-slate-100 rounded overflow-hidden flex items-center justify-center">
                {asset.url ? (
                  <img src={asset.url} alt={asset.original_filename} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                )}
              </div>

              <div>
                <div className="text-xs font-medium text-slate-900 truncate" title={asset.original_filename}>
                  {asset.original_filename}
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate">{t('media.shaLabel')} {asset.checksum_sha256}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {(asset.byte_size / 1024).toFixed(1)} {t('media.kbUnit')} · {asset.content_type}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  {asset.status}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(asset.id)}
                  className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-50"
                  title={t('media.safeDelete')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deletingAssetId)}
        title={t('media.deleteModalTitle')}
        description={t('media.deleteModalDescription')}
        confirmLabel={t('media.deleteConfirm')}
        cancelLabel={t('media.keepAsset')}
        variant="danger"
        loading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingAssetId(null)}
      />

      <ConfirmModal
        isOpen={conflictModalOpen}
        title={t('media.conflictModalTitle')}
        description={conflictMessage || t('media.conflictFallback')}
        confirmLabel={t('media.conflictConfirm')}
        cancelLabel={t('media.close')}
        variant="warning"
        onConfirm={() => setConflictModalOpen(false)}
        onCancel={() => setConflictModalOpen(false)}
      />
    </div>
  );
}
