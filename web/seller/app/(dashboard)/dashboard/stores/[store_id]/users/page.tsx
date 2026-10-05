import { TeamScreen } from '@/components/seller/TeamScreen';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function UsersPage({ params }: Props) {
  const { store_id } = await params;
  return <TeamScreen storeId={store_id} />;
}
