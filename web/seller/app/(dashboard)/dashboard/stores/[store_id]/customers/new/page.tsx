import { UnsupportedCapabilityScreen } from '@/components/seller/UnsupportedCapabilityScreen';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function NewCustomerPage({ params }: Props) {
  const { store_id } = await params;
  return (
    <UnsupportedCapabilityScreen
      eyebrow="Customers"
      title="Manual customer creation is not available yet"
      description="Creating customer records from the Seller Dashboard is deferred until Core exposes customer ownership, consent, and identity-linking contracts."
      storeId={store_id}
      primaryHref={`/dashboard/stores/${store_id}/orders`}
      primaryLabel="View orders"
    />
  );
}
