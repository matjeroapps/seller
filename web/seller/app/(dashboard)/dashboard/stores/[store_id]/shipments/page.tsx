import { ShipmentsOverviewScreen } from '@/components/seller/ShipmentsOverviewScreen';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function StoreShipmentsPage({ params }: Props) {
  const { store_id } = await params;
  return <ShipmentsOverviewScreen storeId={store_id} />;
}
