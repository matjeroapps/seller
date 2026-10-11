import { UnsupportedCapabilityScreen } from '@/components/seller/UnsupportedCapabilityScreen';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function CartsPage({ params }: Props) {
  const { store_id } = await params;
  return (
    <UnsupportedCapabilityScreen
      copyKey="unsupported.carts"
      storeId={store_id}
      primaryHref={`/dashboard/stores/${store_id}/orders`}
    />
  );
}
