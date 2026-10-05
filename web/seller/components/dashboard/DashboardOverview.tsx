'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Card, Container, Grid, PageHeader, Stack, Button } from '@matjerhub/ui-sdk';
import { Building2, Store as StoreIcon, PlusCircle, ArrowRight } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { Store } from '@/lib/api/types';
import { fetchMerchantConsole, isOperableWorkspace, type MerchantWorkspace } from '@/lib/api/merchant-console';

export function DashboardOverview() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [workspaces, setWorkspaces] = useState<MerchantWorkspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([sellerApi.getStores(), fetchMerchantConsole()])
      .then(([storesResult, consoleResult]) => {
        if (!isMounted) return;
        const items = storesResult.status === 'fulfilled' ? storesResult.value.items || [] : [];
        const merchantWorkspaces =
          consoleResult.status === 'fulfilled' ? consoleResult.value.workspaces.filter(isOperableWorkspace) : [];

        setLoading(false);
        setStores(items);
        setWorkspaces(merchantWorkspaces);

        if (merchantWorkspaces.length === 1 && merchantWorkspaces[0].stores.length === 1) {
          const workspace = merchantWorkspaces[0];
          router.replace(`/dashboard/merchants/${workspace.merchant_id}/stores/${workspace.stores[0].id}`);
          return;
        }

        if (merchantWorkspaces.length > 0) {
          return;
        }

        if (items.length === 0) {
          router.replace('/dashboard/onboarding');
        } else if (items.length === 1) {
          router.replace(`/dashboard/stores/${items[0].id}`);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <Container size="xl">
        <div className="p-8 text-center text-sm text-slate-500 animate-pulse">
          Loading merchant stores...
        </div>
      </Container>
    );
  }

  if (workspaces.length > 0) {
    return (
      <Container size="xl">
        <Stack gap="xl">
          <PageHeader
            title="Merchant Console"
            subtitle="Choose a merchant workspace to manage retail and supply operations."
          />
          <Grid cols={3} gap="lg">
            {workspaces.map((workspace) => (
              <Link
                key={workspace.merchant_id}
                href={`/dashboard/merchants/${workspace.merchant_id}`}
                data-merchant-id={workspace.merchant_id}
                data-testid={`merchant-workspace-card-${workspace.merchant_code}`}
                className="block rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                      <Building2 className="h-4 w-4" aria-hidden="true" />
                      {workspace.merchant_code}
                    </div>
                    <h2 className="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">{workspace.legal_name}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {workspace.stores.length} authorized store{workspace.stores.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Badge variant="default" className="uppercase">
                    {workspace.membership.status}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-medium text-indigo-600 dark:border-slate-800">
                  <span>Open workspace</span>
                  <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                </div>
              </Link>
            ))}
          </Grid>
        </Stack>
      </Container>
    );
  }

  if (stores.length === 0) {
    return (
      <Container size="md">
        <Card padding="lg" className="text-center py-12 space-y-4">
          <div className="flex justify-center">
            <div className="p-3 bg-indigo-50 rounded-full text-indigo-600">
              <StoreIcon className="w-8 h-8" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-slate-900">No Store Configured</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Welcome to MatjerHub! Set up your digital store to start importing supplier offers and merchandising your storefront.
          </p>
          <div className="pt-2">
            <Button variant="primary" onClick={() => router.push('/dashboard/onboarding')} className="flex items-center gap-2 mx-auto">
              <PlusCircle className="w-4 h-4" />
              Start Store Onboarding
            </Button>
          </div>
        </Card>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack gap="xl">
        <PageHeader
          title="Seller Stores"
          subtitle="Manage your active stores and launch readiness."
          actions={
            <Button variant="primary" onClick={() => router.push('/dashboard/onboarding')} className="flex items-center gap-1.5 text-xs">
              <PlusCircle className="w-4 h-4" />
              New Store
            </Button>
          }
        />
        <Grid cols={3} gap="lg">
          {stores.map((st) => (
            <Card key={st.id} padding="lg" className="hover:border-slate-300 transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/stores/${st.id}`)}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{st.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{st.code}.matjerhub.local</p>
                </div>
                <Badge variant={st.status === 'active' ? 'default' : 'secondary'} className="uppercase">
                  {st.status}
                </Badge>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-medium">
                <span>Open Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </div>
            </Card>
          ))}
        </Grid>
      </Stack>
    </Container>
  );
}
