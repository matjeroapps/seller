import { CapabilityState } from '@/components/seller/CapabilityState';
import { createUnavailableState } from '@/lib/screens/state';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function NewCustomerPage({ params }: Props) {
  const { store_id } = await params;
  const state = createUnavailableState(
    'Customer Creation',
    'Manual customer profile creation is not supported by Core.',
    `/dashboard/stores/${store_id}/orders`,
    'View Store Orders'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Create New Customer</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Add a buyer record manually.</p>
      </div>
      <CapabilityState state={state} />
    </div>
  );
}
