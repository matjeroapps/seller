import { CapabilityState } from '@/components/seller/CapabilityState';
import { createUnavailableState } from '@/lib/screens/state';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function NewPayoutPage({ params }: Props) {
  const { store_id } = await params;
  const state = createUnavailableState(
    'Manual Payout Requests',
    'Manual payout creation and bank verification forms are not supported by Core.',
    `/dashboard/stores/${store_id}/finance`,
    'View Wallet & Settlements'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Request Payout</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Withdraw store wallet funds to bank account.</p>
      </div>
      <CapabilityState state={state} />
    </div>
  );
}
