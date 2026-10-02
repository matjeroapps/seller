import { CapabilityState } from '@/components/seller/CapabilityState';
import { createUnavailableState } from '@/lib/screens/state';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function BillingPage({ params }: Props) {
  const { store_id } = await params;
  const state = createUnavailableState(
    'Billing & Subscriptions',
    'Platform plan management, subscription upgrades, and billing invoices are not supported by Core.',
    `/dashboard/stores/${store_id}/finance`,
    'View Store Wallet'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Billing & Subscription Plans</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage plan tier and billing invoices.</p>
      </div>
      <CapabilityState state={state} />
    </div>
  );
}
