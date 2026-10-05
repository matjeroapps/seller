import { UnsupportedCapabilityScreen } from '@/components/seller/UnsupportedCapabilityScreen';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function CartsPage({ params }: Props) {
  const { store_id } = await params;
  return (
    <UnsupportedCapabilityScreen
      eyebrow="Orders"
      title="Customer carts are not available yet"
      description="Active cart tracking and abandoned cart recovery need a dedicated Core read model before they can be shown safely in the Seller Dashboard."
      backlogNote="Completed orders are available now, so use the orders list for confirmed buyer activity."
      storeId={store_id}
      primaryHref={`/dashboard/stores/${store_id}/orders`}
      primaryLabel="View completed orders"
    />
  );
}
