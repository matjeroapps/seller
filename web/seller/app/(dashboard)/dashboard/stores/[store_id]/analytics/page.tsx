import { CapabilityState } from '@/components/seller/CapabilityState';
import { createUnavailableState } from '@/lib/screens/state';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({ params }: Props) {
  const { store_id } = await params;
  const state = createUnavailableState(
    'Advanced Analytics & Export',
    'Custom reporting, cohort analytics, and CSV exports are not supported by Core; key operational metrics are available on your Store Overview.',
    `/dashboard/stores/${store_id}`,
    'View Store Overview'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Advanced Analytics</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Deep performance analytics and custom reports.</p>
      </div>
      <CapabilityState state={state} />
    </div>
  );
}
