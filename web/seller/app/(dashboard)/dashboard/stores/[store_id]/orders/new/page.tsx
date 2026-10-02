import { CapabilityState } from '@/components/seller/CapabilityState';
import { createUnavailableState } from '@/lib/screens/state';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function NewOrderPage({ params }: Props) {
  const { store_id } = await params;
  const state = createUnavailableState(
    'Manual Order Creation',
    'Creating draft orders or manual phone orders is not supported by Core.',
    `/dashboard/stores/${store_id}/orders`,
    'View Store Orders'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Create New Order</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manually submit a customer order.</p>
      </div>
      <CapabilityState state={state} />
    </div>
  );
}
