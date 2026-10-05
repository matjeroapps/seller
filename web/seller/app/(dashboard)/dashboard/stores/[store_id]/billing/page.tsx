import { UnsupportedCapabilityScreen } from '@/components/seller/UnsupportedCapabilityScreen';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function BillingPage({ params }: Props) {
  const { store_id } = await params;
  return (
    <UnsupportedCapabilityScreen
      eyebrow="Billing"
      title="Platform billing is not available in the Seller Dashboard yet"
      description="Subscription plans, invoices, and platform billing should be managed through a platform-level billing contract, not the store finance wallet."
      storeId={store_id}
      primaryHref={`/dashboard/stores/${store_id}/finance`}
      primaryLabel="View finance wallet"
    />
  );
}
