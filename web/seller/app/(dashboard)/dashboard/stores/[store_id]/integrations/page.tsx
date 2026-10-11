'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Link2, Plus, RefreshCw, CheckCircle2, AlertCircle, Layers, Key, Webhook, Copy, Trash2, ShieldCheck } from 'lucide-react';
import { ConfirmModal } from '@/components/seller/ConfirmModal';
import { useTranslation } from '@/lib/i18n/locale-context';
import { sellerApi } from '@/lib/api/client';
import type { IntegrationConnection, ExternalEntityMapping, SellerSyncJob, ApiKey, WebhookSubscription } from '@/lib/api/types';

const TAB_LABEL_KEYS = {
  API_KEYS: 'integrations.tabApiKeys',
  WEBHOOKS: 'integrations.tabWebhooks',
  CONNECTIONS: 'integrations.tabConnections',
  MAPPINGS: 'integrations.tabMappings',
  SYNC_JOBS: 'integrations.tabSyncJobs'
} as const;

export default function StoreIntegrationsPage({
  params
}: {
  params: Promise<{ store_id: string }>;
}) {
  const { store_id } = use(params);
  const { t } = useTranslation();

  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [mappings, setMappings] = useState<ExternalEntityMapping[]>([]);
  const [syncJobs, setSyncJobs] = useState<SellerSyncJob[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'API_KEYS' | 'WEBHOOKS' | 'CONNECTIONS' | 'MAPPINGS' | 'SYNC_JOBS'>('API_KEYS');

  // Connection state
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('product');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [provider, setProvider] = useState<string>('salla');
  const [connectionName, setConnectionName] = useState<string>('');

  // API Key state
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyName, setApiKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['products:read', 'orders:read']);
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);

  // Webhook state
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');
  const [subscribedEvents, setSubscribedEvents] = useState<string[]>(['product.updated', 'order.created']);

  // Modal confirmation states
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [deleteWebhookId, setDeleteWebhookId] = useState<string | null>(null);
  const [isDeletingWebhook, setIsDeletingWebhook] = useState(false);

  const AVAILABLE_SCOPES = [
    'products:read', 'products:write',
    'inventory:read', 'inventory:write',
    'orders:read', 'orders:write',
    'webhooks:manage'
  ];

  const AVAILABLE_EVENTS = [
    'product.created', 'product.updated',
    'inventory.adjusted',
    'order.created', 'order.status_changed'
  ];

  const PROVIDER_OPTIONS: { value: string; labelKey: string }[] = [
    { value: 'salla', labelKey: 'integrations.providerSalla' },
    { value: 'shopify', labelKey: 'integrations.providerShopify' },
    { value: 'woocommerce', labelKey: 'integrations.providerWooCommerce' },
    { value: 'easyorders', labelKey: 'integrations.providerEasyOrders' },
    { value: 'custom_api', labelKey: 'integrations.providerCustomApi' }
  ];

  const fetchConnections = () => {
    setLoading(true);
    sellerApi
      .listStoreConnections(store_id)
      .then((res) => {
        const items = res.items || [];
        setConnections(items);
        if (items.length > 0 && !selectedConnection) {
          setSelectedConnection(items[0].id);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  const fetchMappings = () => {
    if (!selectedConnection) return;
    sellerApi
      .listStoreEntityMappings(store_id, selectedConnection, selectedEntityType)
      .then((res) => {
        setMappings(res.items || []);
      })
      .catch(() => {
        setMappings([]);
      });
  };

  const fetchSyncJobs = () => {
    sellerApi
      .listStoreSyncJobs(store_id)
      .then((res) => {
        setSyncJobs(res.items || []);
      })
      .catch(() => {
        setSyncJobs([]);
      });
  };

  const fetchApiKeys = () => {
    sellerApi
      .listStoreAPIKeys(store_id)
      .then((res) => {
        setApiKeys(res.items || []);
      })
      .catch(() => {
        setApiKeys([]);
      });
  };

  const fetchWebhooks = () => {
    sellerApi
      .listStoreWebhookSubscriptions(store_id)
      .then((res) => {
        setWebhooks(res.items || []);
      })
      .catch(() => {
        setWebhooks([]);
      });
  };

  useEffect(() => {
    fetchConnections();
    fetchSyncJobs();
    fetchApiKeys();
    fetchWebhooks();
  }, [store_id]);

  useEffect(() => {
    if (activeTab === 'MAPPINGS' && selectedConnection) {
      fetchMappings();
    } else if (activeTab === 'SYNC_JOBS') {
      fetchSyncJobs();
    } else if (activeTab === 'API_KEYS') {
      fetchApiKeys();
    } else if (activeTab === 'WEBHOOKS') {
      fetchWebhooks();
    }
  }, [activeTab, selectedConnection, selectedEntityType]);

  const handleCreateConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectionName) return;
    sellerApi
      .createStoreConnection(store_id, {
        provider,
        name: connectionName
      })
      .then(() => {
        setShowConnectModal(false);
        setConnectionName('');
        fetchConnections();
      });
  };

  const handleTriggerSyncJob = (connectionId: string) => {
    sellerApi
      .createStoreSyncJob(store_id, { connection_id: connectionId, sync_type: 'full' })
      .then(() => {
        fetchSyncJobs();
        setActiveTab('SYNC_JOBS');
      });
  };

  const handleCreateApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyName) return;
    sellerApi
      .createStoreAPIKey(store_id, {
        name: apiKeyName,
        scopes: selectedScopes
      })
      .then((key) => {
        if (key.raw_key) {
          setCreatedRawKey(key.raw_key);
        }
        setApiKeyName('');
        fetchApiKeys();
      });
  };

  const handleRevokeApiKey = (keyId: string) => {
    setRevokeKeyId(keyId);
  };

  const confirmRevokeApiKey = async () => {
    if (!revokeKeyId) return;
    setIsRevoking(true);
    try {
      await sellerApi.revokeStoreAPIKey(store_id, revokeKeyId);
      setRevokeKeyId(null);
      fetchApiKeys();
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCreateWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl) return;
    sellerApi
      .createStoreWebhookSubscription(store_id, {
        target_url: targetUrl,
        subscribed_events: subscribedEvents
      })
      .then(() => {
        setShowWebhookModal(false);
        setTargetUrl('');
        fetchWebhooks();
      });
  };

  const handleDeleteWebhook = (subId: string) => {
    setDeleteWebhookId(subId);
  };

  const confirmDeleteWebhook = async () => {
    if (!deleteWebhookId) return;
    setIsDeletingWebhook(true);
    try {
      await sellerApi.deleteStoreWebhookSubscription(store_id, deleteWebhookId);
      setDeleteWebhookId(null);
      fetchWebhooks();
    } finally {
      setIsDeletingWebhook(false);
    }
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const toggleEvent = (event: string) => {
    setSubscribedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('integrations.title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{t('integrations.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'API_KEYS' && (
            <button
              type="button"
              onClick={() => {
                setCreatedRawKey(null);
                setShowApiKeyModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 transition-colors"
            >
              <Key className="w-4 h-4" />
              {t('integrations.actionGenerateKey')}
            </button>
          )}
          {activeTab === 'WEBHOOKS' && (
            <button
              type="button"
              onClick={() => setShowWebhookModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 transition-colors"
            >
              <Webhook className="w-4 h-4" />
              {t('integrations.actionSubscribeWebhook')}
            </button>
          )}
          {activeTab === 'CONNECTIONS' && (
            <button
              type="button"
              onClick={() => setShowConnectModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('integrations.actionAddConnection')}
            </button>
          )}
        </div>
      </div>

      {/* Merchant Hub Navigation Banner */}
      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5">
          <Layers className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-indigo-900 block">{t('integrations.bannerTitle')}</span>
            <span className="text-indigo-700">{t('integrations.bannerBody')}</span>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="px-3.5 py-1.5 bg-white text-indigo-700 font-semibold border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors shrink-0 text-center shadow-sm"
        >
          {t('integrations.bannerLink')}
        </Link>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {(['API_KEYS', 'WEBHOOKS', 'CONNECTIONS', 'MAPPINGS', 'SYNC_JOBS'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === tab
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t(TAB_LABEL_KEYS[tab])}
          </button>
        ))}
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="p-8 bg-white border border-slate-200 rounded-lg text-xs text-slate-500 animate-pulse">
          {t('integrations.loadingConsole')}
        </div>
      ) : activeTab === 'CONNECTIONS' ? (
        connections.length === 0 ? (
          <div className="p-8 bg-white border border-slate-200 rounded-lg text-center space-y-3">
            <Link2 className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-xs font-medium text-slate-700">{t('integrations.connectionsEmptyTitle')}</div>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">{t('integrations.connectionsEmptyBody')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connections.map((conn) => (
              <div key={conn.id} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-700 font-semibold uppercase text-xs">
                      {conn.provider.slice(0, 3)}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{conn.name}</h3>
                      <p className="text-[11px] text-slate-400 font-mono">{t('integrations.idLabel')} {conn.id}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                      conn.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {conn.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {conn.status.toUpperCase()}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{t('integrations.providerLabel')} <strong className="text-slate-700 uppercase">{conn.provider}</strong></span>
                  <button
                    type="button"
                    onClick={() => handleTriggerSyncJob(conn.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded font-medium transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {t('integrations.triggerSyncJob')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : activeTab === 'API_KEYS' ? (
        /* API KEYS TAB */
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-600" />
                {t('integrations.apiKeysTitle')}
              </h2>
              <button
                type="button"
                onClick={fetchApiKeys}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md font-medium inline-flex items-center gap-1 text-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t('integrations.refreshKeys')}
              </button>
            </div>

            {apiKeys.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <Key className="w-8 h-8 text-slate-300 mx-auto" />
                <p>{t('integrations.apiKeysEmpty')}</p>
                <p className="text-[11px] text-slate-400">{t('integrations.apiKeysEmptyHint')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-medium">
                    <tr>
                      <th className="p-2.5">{t('integrations.colName')}</th>
                      <th className="p-2.5">{t('integrations.colPrefix')}</th>
                      <th className="p-2.5">{t('integrations.colScopes')}</th>
                      <th className="p-2.5">{t('integrations.colStatus')}</th>
                      <th className="p-2.5">{t('integrations.colCreatedAt')}</th>
                      <th className="p-2.5 text-right">{t('integrations.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {apiKeys.map((key) => (
                      <tr key={key.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-semibold text-slate-900">{key.name}</td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-600">{key.key_prefix}...</td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1">
                            {key.scopes?.map((s) => (
                              <span key={s} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-mono">
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                              key.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {key.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-400">{new Date(key.created_at).toLocaleString()}</td>
                        <td className="p-2.5 text-right">
                          {key.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => handleRevokeApiKey(key.id)}
                              className="px-2 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded text-[11px] font-medium transition-colors"
                            >
                              {t('integrations.revoke')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'WEBHOOKS' ? (
        /* WEBHOOKS TAB */
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Webhook className="w-4 h-4 text-slate-600" />
                {t('integrations.webhooksTitle')}
              </h2>
              <button
                type="button"
                onClick={fetchWebhooks}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md font-medium inline-flex items-center gap-1 text-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t('integrations.refreshSubscriptions')}
              </button>
            </div>

            {webhooks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <Webhook className="w-8 h-8 text-slate-300 mx-auto" />
                <p>{t('integrations.webhooksEmpty')}</p>
                <p className="text-[11px] text-slate-400">{t('integrations.webhooksEmptyHint')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-medium">
                    <tr>
                      <th className="p-2.5">{t('integrations.colTargetUrl')}</th>
                      <th className="p-2.5">{t('integrations.colSubscribedEvents')}</th>
                      <th className="p-2.5">{t('integrations.colStatus')}</th>
                      <th className="p-2.5">{t('integrations.colCreatedAt')}</th>
                      <th className="p-2.5 text-right">{t('integrations.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {webhooks.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono text-[11px] text-slate-900 max-w-xs truncate">{sub.target_url}</td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1">
                            {sub.subscribed_events?.map((e) => (
                              <span key={e} className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 font-mono">
                                {e}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {sub.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-400">{new Date(sub.created_at).toLocaleString()}</td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteWebhook(sub.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'MAPPINGS' ? (
        /* MAPPINGS TAB */
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center gap-4 text-xs">
            <div className="space-y-1">
              <label className="block text-slate-500 font-medium">{t('integrations.mappingConnectionLabel')}</label>
              <select
                value={selectedConnection}
                onChange={(e) => setSelectedConnection(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-md bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.provider})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-slate-500 font-medium">{t('integrations.mappingEntityTypeLabel')}</label>
              <select
                value={selectedEntityType}
                onChange={(e) => setSelectedEntityType(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-md bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                {['product', 'variant', 'inventory', 'order', 'fulfillment', 'customer'].map((entityType) => (
                  <option key={entityType} value={entityType}>
                    {entityType.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={fetchMappings}
              className="mt-5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md font-medium inline-flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t('integrations.refreshMappings')}
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-600" />
              {t('integrations.mappingsTitle')}
            </h2>

            {mappings.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">{t('integrations.mappingsEmpty')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-medium">
                    <tr>
                      <th className="p-2.5">{t('integrations.colMappingId')}</th>
                      <th className="p-2.5">{t('integrations.colInternalId')}</th>
                      <th className="p-2.5">{t('integrations.colExternalId')}</th>
                      <th className="p-2.5">{t('integrations.colStatus')}</th>
                      <th className="p-2.5">{t('integrations.colDirection')}</th>
                      <th className="p-2.5">{t('integrations.colLastSynced')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mappings.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono text-[11px]">{m.id}</td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-900 font-semibold">{m.internal_id}</td>
                        <td className="p-2.5 font-mono text-[11px] text-blue-600">{m.external_id}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {m.mapping_status}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-500">{m.sync_direction}</td>
                        <td className="p-2.5 text-slate-400">{new Date(m.last_synced_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SYNC JOBS TAB */
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-slate-600" />
              {t('integrations.syncJobsTitle')}
            </h2>
            <button
              type="button"
              onClick={fetchSyncJobs}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md font-medium inline-flex items-center gap-1 text-xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t('integrations.refreshJobs')}
            </button>
          </div>

          {syncJobs.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">{t('integrations.syncJobsEmpty')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-medium">
                  <tr>
                    <th className="p-2.5">{t('integrations.colJobId')}</th>
                    <th className="p-2.5">{t('integrations.colConnectionId')}</th>
                    <th className="p-2.5">{t('integrations.colSyncType')}</th>
                    <th className="p-2.5">{t('integrations.colStatus')}</th>
                    <th className="p-2.5">{t('integrations.colProcessedTotal')}</th>
                    <th className="p-2.5">{t('integrations.colCreatedAt')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {syncJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono text-[11px] text-slate-900 font-semibold">{job.id}</td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-500">{job.connection_id}</td>
                      <td className="p-2.5 uppercase text-slate-700">{job.sync_type || 'FULL'}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                            job.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : job.status === 'RUNNING'
                              ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
                              : job.status === 'FAILED'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-[11px]">
                        {job.processed_items} / {job.total_items} {job.failed_items > 0 && <span className="text-rose-600">({job.failed_items} {t('integrations.failedSuffix')}</span>}
                      </td>
                      <td className="p-2.5 text-slate-400">{new Date(job.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg border border-slate-200 p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">{t('integrations.connectModalTitle')}</h3>
            <form onSubmit={handleCreateConnection} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-600 font-medium">{t('integrations.providerFieldLabel')}</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-800"
                >
                  {PROVIDER_OPTIONS.map((providerOption) => (
                    <option key={providerOption.value} value={providerOption.value}>
                      {t(providerOption.labelKey)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-600 font-medium">{t('integrations.connectionNameLabel')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('integrations.connectionNamePlaceholder')}
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-md font-medium"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-md font-medium"
                >
                  {t('integrations.createConnection')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg border border-slate-200 p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-slate-700" />
              {t('integrations.apiKeyModalTitle')}
            </h3>

            {createdRawKey ? (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    {t('integrations.saveKeyWarning')}
                  </p>
                  <p className="text-[11px]">
                    {t('integrations.saveNeverPrefix')}
                    <strong>{t('integrations.saveNeverStrong')}</strong>
                    {t('integrations.saveNeverSuffix')}
                  </p>
                </div>

                <div className="p-3 bg-slate-900 rounded-md font-mono text-[11px] text-emerald-400 break-all select-all flex items-center justify-between gap-2">
                  <span>{createdRawKey}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(createdRawKey)}
                    className="p-1 hover:bg-slate-800 rounded text-slate-300 transition-colors shrink-0"
                    title={t('integrations.copyToClipboard')}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-100 text-right">
                  <button
                    type="button"
                    onClick={() => setShowApiKeyModal(false)}
                    className="px-4 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-md font-medium"
                  >
                    {t('integrations.done')}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateApiKey} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="block text-slate-600 font-medium">{t('integrations.keyNameLabel')}</label>
                  <input
                    type="text"
                    required
                    placeholder={t('integrations.keyNamePlaceholder')}
                    value={apiKeyName}
                    onChange={(e) => setApiKeyName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-slate-600 font-medium">{t('integrations.scopesLabel')}</label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-md bg-slate-50">
                    {AVAILABLE_SCOPES.map((scope) => (
                      <label key={scope} className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700">
                        <input
                          type="checkbox"
                          checked={selectedScopes.includes(scope)}
                          onChange={() => toggleScope(scope)}
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        <span className="font-mono">{scope}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowApiKeyModal(false)}
                    className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-md font-medium"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-md font-medium"
                  >
                    {t('integrations.generateKey')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Subscribe Webhook Modal */}
      {showWebhookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg border border-slate-200 p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Webhook className="w-5 h-5 text-slate-700" />
              {t('integrations.webhookModalTitle')}
            </h3>
            <form onSubmit={handleCreateWebhook} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-600 font-medium">{t('integrations.targetUrlLabel')}</label>
                <input
                  type="url"
                  required
                  placeholder="https://api.yourdomain.com/webhooks/matjerhub"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono text-[11px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-600 font-medium">{t('integrations.eventsLabel')}</label>
                <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-md bg-slate-50">
                  {AVAILABLE_EVENTS.map((event) => (
                    <label key={event} className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={subscribedEvents.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <span className="font-mono">{event}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowWebhookModal(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-md font-medium"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-md font-medium"
                >
                  {t('integrations.saveSubscription')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke API Key Modal */}
      <ConfirmModal
        isOpen={Boolean(revokeKeyId)}
        title={t('integrations.revokeModalTitle')}
        description={t('integrations.revokeModalDescription')}
        confirmLabel={t('integrations.revokeConfirm')}
        cancelLabel={t('integrations.revokeCancel')}
        variant="danger"
        loading={isRevoking}
        onConfirm={confirmRevokeApiKey}
        onCancel={() => setRevokeKeyId(null)}
      />

      {/* Delete Webhook Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteWebhookId)}
        title={t('integrations.deleteWebhookModalTitle')}
        description={t('integrations.deleteWebhookModalDescription')}
        confirmLabel={t('integrations.deleteWebhookConfirm')}
        cancelLabel={t('integrations.keepWebhook')}
        variant="danger"
        loading={isDeletingWebhook}
        onConfirm={confirmDeleteWebhook}
        onCancel={() => setDeleteWebhookId(null)}
      />
    </div>
  );
}
