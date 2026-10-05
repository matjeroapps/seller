'use client';

import { use } from 'react';
import { useParams } from 'next/navigation';

import { OrderDetailScreen } from '@/components/seller/OrderDetailScreen';
export { getStatusBadge } from '@/components/seller/OrderStatusBadge';

type Props = {
  params?: Promise<{ store_id: string; order_id: string }> | { store_id: string; order_id: string };
};

export default function StoreOrderDetailPage({ params }: Props) {
  const routeParams = params
    ? typeof (params as Promise<{ store_id: string; order_id: string }>).then === 'function'
      ? use(params as Promise<{ store_id: string; order_id: string }>)
      : params
    : useParams<{ store_id: string; order_id: string }>();

  const { store_id, order_id } = routeParams as { store_id: string; order_id: string };
  return <OrderDetailScreen storeId={store_id} orderId={order_id} />;
}
