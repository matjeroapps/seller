import { UnsupportedCapabilityScreen } from '@/components/seller/UnsupportedCapabilityScreen';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function CustomersPage({ params }: Props) {
  const { store_id } = await params;
  return (
    <UnsupportedCapabilityScreen
      eyebrow="Customers"
      title="Customer directory is not available yet"
      description="Customer profile management requires Core customer-directory contracts. The dashboard will not show guessed or order-derived customer records as a real directory."
      backlogNote="For now, customer details are available inside each completed order."
      storeId={store_id}
      primaryHref={`/dashboard/stores/${store_id}/orders`}
      primaryLabel="View orders"
    />
  );
}
