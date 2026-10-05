import { UnsupportedCapabilityScreen } from '@/components/seller/UnsupportedCapabilityScreen';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function NewPayoutPage({ params }: Props) {
  const { store_id } = await params;
  return (
    <UnsupportedCapabilityScreen
      eyebrow="Finance"
      title="Manual payout requests are not available yet"
      description="Payout request and bank-account verification contracts are not exposed to the Seller Dashboard yet. Available balances and settlement history remain visible in Finance."
      storeId={store_id}
      primaryHref={`/dashboard/stores/${store_id}/finance`}
      primaryLabel="View finance"
    />
  );
}
