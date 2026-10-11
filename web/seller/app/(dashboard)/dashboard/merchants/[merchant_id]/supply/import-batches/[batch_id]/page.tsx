'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';

import { merchantSupplyApi, type SupplyImportBatchDetail } from '@/lib/api/merchant-console';
import { SupplyEmpty, SupplyError, SupplyLoading } from '@/components/supply/supply-state';
import { useTranslation } from '@/lib/i18n/locale-context';

export default function SupplyImportBatchDetailPage({
  params
}: {
  params: Promise<{ merchant_id: string; batch_id: string }>;
}) {
  const { merchant_id, batch_id } = use(params);
  const { t } = useTranslation();
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'denied' } | { status: 'error' } | { status: 'empty' } | { status: 'ready'; data: SupplyImportBatchDetail }
  >({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    merchantSupplyApi
      .getImportBatch(merchant_id, batch_id, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setState(data.records.length === 0 ? { status: 'empty' } : { status: 'ready', data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [merchant_id, batch_id]);

  return (
    <div className="space-y-6" data-testid="supply-import-batch-detail">
      <Link
        href={`/dashboard/merchants/${merchant_id}/supply/import-batches`}
        className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        ← {t('nav.importBatches')}
      </Link>

      {state.status === 'loading' && <SupplyLoading />}
      {state.status === 'error' && <SupplyError />}
      {state.status === 'empty' && (
        <SupplyEmpty title={t('supply.importBatches.detailEmptyTitle')} message={t('supply.importBatches.detailEmptyBody')} />
      )}
      {state.status === 'ready' && (
        <>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {state.data.batch.provider} · {state.data.batch.batch_type}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('supply.importBatches.batchStatusLabel')} <span className="font-semibold">{state.data.batch.status}</span> · {t('supply.importBatches.stagedDisclaimer')}
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{t('supply.importBatches.colEntity')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{t('supply.importBatches.colExternalProduct')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{t('supply.importBatches.colSku')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{t('supply.importBatches.colTitle')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{t('supply.importBatches.colStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
                {state.data.records.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{record.entity_type}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{record.external_product_id}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{record.sku || '—'}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{record.title || '—'}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{record.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
