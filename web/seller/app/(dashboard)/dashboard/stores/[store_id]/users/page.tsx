import { CapabilityState } from '@/components/seller/CapabilityState';
import { createUnavailableState } from '@/lib/screens/state';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function UsersPage({ params }: Props) {
  const { store_id } = await params;
  const state = createUnavailableState(
    'Team & User Management',
    'Inviting team members and assigning store role permissions are managed directly through your Identity Provider (ZITADEL).',
    `/dashboard/stores/${store_id}/settings`,
    'View Store Settings'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Team Management</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage store access and team invitations.</p>
      </div>
      <CapabilityState state={state} />
    </div>
  );
}
