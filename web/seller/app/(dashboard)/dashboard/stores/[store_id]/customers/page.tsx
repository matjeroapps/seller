import { SellerStitchScreen } from '@/components/stitch/SellerStitchScreen';
import { customerManagementScreen } from '@/components/stitch/seller-stitch-screen-configs';

export default async function StoreCustomersPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerStitchScreen screen={customerManagementScreen} storeId={store_id} />;
}
