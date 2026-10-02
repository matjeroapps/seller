import { OrderDocumentsScreen } from '@/components/seller/OrderDocumentsScreen';

type Props = {
  params: Promise<{ store_id: string; order_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function OrderDocumentsPage({ params }: Props) {
  const { store_id, order_id } = await params;
  return <OrderDocumentsScreen storeId={store_id} orderId={order_id} />;
}
