import { CapabilityState } from '@/components/seller/CapabilityState';
import { createUnavailableState } from '@/lib/screens/state';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function NotificationsPage({ params }: Props) {
  const { store_id } = await params;
  const state = createUnavailableState(
    'Notifications Feed',
    'In-app seller notification feeds and alert preferences are not supported by Core.',
    `/dashboard/stores/${store_id}/account`,
    'View Account Settings'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Notifications Center</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">View operational alerts and feed messages.</p>
      </div>
      <CapabilityState state={state} />
    </div>
  );
}
