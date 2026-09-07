import type { ReactNode } from 'react';

import { requireAuth } from '@/lib/auth';
import { SellerShell } from '@/components/shell/SellerShell';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireAuth();

  return <SellerShell user={user}>{children}</SellerShell>;
}
