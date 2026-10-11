import { UnsupportedCapabilityScreen } from '@/components/seller/UnsupportedCapabilityScreen';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function BillingPage({ params }: Props) {
  const { store_id } = await params;
  return (
    <UnsupportedCapabilityScreen
      copyKey="unsupported.billing"
      storeId={store_id}
      primaryHref={`/dashboard/stores/${store_id}/finance`}
    />
  );
}
