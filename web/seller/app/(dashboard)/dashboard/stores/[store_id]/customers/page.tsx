import { SellerScreen } from '@/components/seller/SellerScreen';
import { customerManagementScreen } from '@/components/seller/Configs';

export default async function StoreCustomersPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerScreen screen={customerManagementScreen} storeId={store_id} />;
}
