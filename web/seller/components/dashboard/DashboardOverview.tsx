'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Card, Container, Grid, PageHeader, Stack, Button } from '@matjerhub/ui-sdk';
import { Building2, Store as StoreIcon, PlusCircle, ArrowRight } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { Store } from '@/lib/api/types';
import {
  fetchMerchantConsole,
  isOperableWorkspace,
  type MerchantWorkspace,
  type MerchantWorkspaceStore
} from '@/lib/api/merchant-console';
import { useTranslation } from '@/lib/i18n/locale-context';

// An "active authorized store" is a store the workspace bootstrap carries with
// an active status. Only exactly one such store makes direct entry
// unambiguous; draft/inactive stores never qualify.
function activeAuthorizedStores(workspace: MerchantWorkspace): MerchantWorkspaceStore[] {
  return Array.isArray(workspace.stores) ? workspace.stores.filter((store) => store?.status === 'active') : [];
}

export function DashboardOverview() {
  const router = useRouter();
  const { t } = useTranslation();
  const [stores, setStores] = useState<Store[]>([]);
  const [workspaces, setWorkspaces] = useState<MerchantWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  // Resolution must happen once per mount: a completed decision (redirection
  // or explicit choice) is never re-run while stale console/stores responses
  // from an earlier request are still settling.
  const resolvedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([sellerApi.getStores(), fetchMerchantConsole()])
      .then(([storesResult, consoleResult]) => {
        if (!isMounted || resolvedRef.current) return;
        const items =
          storesResult.status === 'fulfilled' && storesResult.value ? storesResult.value.items || [] : [];
        const merchantWorkspaces =
          consoleResult.status === 'fulfilled' && consoleResult.value?.workspaces
            ? consoleResult.value.workspaces.filter(isOperableWorkspace)
            : [];
        const enterableWorkspaces = merchantWorkspaces;

        setLoading(false);
        setStores(items);
        setWorkspaces(enterableWorkspaces);

        // Exactly one enterable workspace plus exactly one active authorized
        // store is unambiguous: enter that store's dashboard directly.
        if (enterableWorkspaces.length === 1) {
          const onlyActiveStores = activeAuthorizedStores(enterableWorkspaces[0]);
          if (onlyActiveStores.length === 1) {
            resolvedRef.current = true;
            router.replace(
              `/dashboard/merchants/${enterableWorkspaces[0].merchant_id}/stores/${onlyActiveStores[0].id}`
            );
            return;
          }
          // Draft/inactive stores or multiple active stores are ambiguous:
          // keep explicit selection showing only enterable workspaces.
          return;
        }

        if (enterableWorkspaces.length > 1) {
          // More than one enterable workspace: the chooser stays explicit.
          return;
        }

        resolvedRef.current = true;
        // Zero enterable workspaces: the honest access/onboarding state only.
        // FR-003 forbids inferring or implicitly selecting a workspace from
        // any legacy store listing; already-explicit legacy store URLs keep
        // serving their own routes, but /dashboard never redirects into them
        // as a substitute for an unambiguous entry decision.
        router.replace('/dashboard/onboarding');
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
          {t('dashboardOverview.loadingStores')}
        </div>
      </Container>
    );
  }

  if (workspaces.length > 0) {
    return (
      <Container size="xl">
        <Stack gap="xl">
          <PageHeader
            title={t('dashboardOverview.merchantConsoleTitle')}
            subtitle={t('dashboardOverview.merchantConsoleSubtitle')}
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
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                      <Building2 className="h-4 w-4" aria-hidden="true" />
                      <span className="mh-ltr-token" dir="ltr">{workspace.merchant_code}</span>
                    </div>
                    <h2 className="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">{workspace.legal_name}</h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {t('dashboardOverview.authorizedStores')
                        .replace('{count}', String(workspace.stores.length))
                        .replace('{plural}', workspace.stores.length === 1 ? '' : 's')}
                    </p>
                  </div>
                  <Badge variant="default" className="uppercase">
                    {t(`statuses.${workspace.membership.status}`, workspace.membership.status)}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  <span>{t('dashboardOverview.openWorkspace')}</span>
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
        <Card padding="lg" className="text-center py-12 space-y-4 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex justify-center">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-full text-indigo-600 dark:text-indigo-400">
              <StoreIcon className="w-8 h-8" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t('dashboardOverview.noStoreTitle')}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {t('dashboardOverview.noStoreBody')}
          </p>
          <div className="pt-2">
            <Button variant="primary" onClick={() => router.push('/dashboard/onboarding')} className="flex items-center gap-2 mx-auto">
              <PlusCircle className="w-4 h-4" />
              {t('dashboardOverview.startStoreOnboarding')}
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
          title={t('dashboardOverview.sellerStoresTitle')}
          subtitle={t('dashboardOverview.sellerStoresSubtitle')}
          actions={
            <Button variant="primary" onClick={() => router.push('/dashboard/onboarding')} className="flex items-center gap-1.5 text-xs">
              <PlusCircle className="w-4 h-4" />
              {t('dashboardOverview.newStore')}
            </Button>
          }
        />
        <Grid cols={3} gap="lg">
          {stores.map((st) => (
            <Card key={st.id} padding="lg" className="hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/stores/${st.id}`)}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{st.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5"><span className="mh-ltr-token" dir="ltr">{st.code}.matjerhub.local</span></p>
                </div>
                <Badge variant={st.status === 'active' ? 'default' : 'secondary'} className="uppercase">
                  {t(`statuses.${st.status}`, st.status)}
                </Badge>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                <span>{t('dashboardOverview.openDashboard')}</span>
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </div>
            </Card>
          ))}
        </Grid>
      </Stack>
    </Container>
  );
}
