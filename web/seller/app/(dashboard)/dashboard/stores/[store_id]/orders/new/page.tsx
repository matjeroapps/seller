import { UnsupportedCapabilityScreen } from '@/components/seller/UnsupportedCapabilityScreen';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function NewOrderPage({ params }: Props) {
  const { store_id } = await params;
  return (
    <UnsupportedCapabilityScreen
      eyebrow="Orders"
      title="Manual order creation is not available yet"
      description="Draft/manual order creation is not currently supported by Core. The Seller Dashboard only shows orders that came through the authenticated storefront checkout flow."
      storeId={store_id}
      primaryHref={`/dashboard/stores/${store_id}/orders`}
      primaryLabel="View store orders"
    />
  );
}
