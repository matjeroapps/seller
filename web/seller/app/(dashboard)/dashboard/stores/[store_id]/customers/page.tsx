import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function CustomersPage({ params }: Props) {
  const { store_id } = await params;
  redirect(`/dashboard/stores/${store_id}/orders`);
}
