'use client';

import { useEffect, useState, use } from 'react';
import { Link2, Plus, RefreshCw, CheckCircle2, AlertCircle, Layers, Key, Webhook, Copy, Trash2, ShieldCheck } from 'lucide-react';
import { ConfirmModal } from '@/components/seller/ConfirmModal';
import { sellerApi } from '@/lib/api/client';
import type { IntegrationConnection, ExternalEntityMapping, SellerSyncJob, ApiKey, WebhookSubscription } from '@/lib/api/types';

export default function StoreIntegrationsPage({
  params
}: {
  params: Promise<{ store_id: string }>;
}) {
  const { store_id } = use(params);

  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [mappings, setMappings] = useState<ExternalEntityMapping[]>([]);
  const [syncJobs, setSyncJobs] = useState<SellerSyncJob[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'CONNECTIONS' | 'API_KEYS' | 'WEBHOOKS' | 'MAPPINGS' | 'SYNC_JOBS'>('CONNECTIONS');
  
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
          <h1 className="text-xl font-bold text-slate-900">External Integration Foundation & Developer Console</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage provider sync connections, scoped Developer API keys, real-time Webhooks, and inspect channel sync job logs.
          </p>
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
              Generate New API Key
            </button>
          )}
          {activeTab === 'WEBHOOKS' && (
            <button
              type="button"
              onClick={() => setShowWebhookModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 transition-colors"
            >
              <Webhook className="w-4 h-4" />
              Subscribe Webhook
            </button>
          )}
          {activeTab === 'CONNECTIONS' && (
            <button
              type="button"
              onClick={() => setShowConnectModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Integration Connection
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {(['CONNECTIONS', 'API_KEYS', 'WEBHOOKS', 'MAPPINGS', 'SYNC_JOBS'] as const).map((tab) => (
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
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="p-8 bg-white border border-slate-200 rounded-lg text-xs text-slate-500 animate-pulse">
          Loading developer console...
        </div>
      ) : activeTab === 'CONNECTIONS' ? (
        connections.length === 0 ? (
          <div className="p-8 bg-white border border-slate-200 rounded-lg text-center space-y-3">
            <Link2 className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-xs font-medium text-slate-700">No integration connections found</div>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Connect external channels like Salla, Shopify, WooCommerce, or custom API webhooks to synchronize products, orders, and inventory.
            </p>
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
                      <p className="text-[11px] text-slate-400 font-mono">ID: {conn.id}</p>
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
                  <span>Provider: <strong className="text-slate-700 uppercase">{conn.provider}</strong></span>
                  <button
                    type="button"
                    onClick={() => handleTriggerSyncJob(conn.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded font-medium transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Trigger Sync Job
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
                Store Developer API Keys
              </h2>
              <button
                type="button"
                onClick={fetchApiKeys}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md font-medium inline-flex items-center gap-1 text-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Keys
              </button>
            </div>

            {apiKeys.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <Key className="w-8 h-8 text-slate-300 mx-auto" />
                <p>No API keys generated for this store yet.</p>
                <p className="text-[11px] text-slate-400">
                  Generate live or test API keys to interact with `/v1/public/...` gateway endpoints for custom ERPs, mobile apps, or inventory tools.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-medium">
                    <tr>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Prefix</th>
                      <th className="p-2.5">Scopes</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Created At</th>
                      <th className="p-2.5 text-right">Actions</th>
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
                              Revoke
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
                Real-Time Webhook Subscriptions
              </h2>
              <button
                type="button"
                onClick={fetchWebhooks}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md font-medium inline-flex items-center gap-1 text-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Subscriptions
              </button>
            </div>

            {webhooks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <Webhook className="w-8 h-8 text-slate-300 mx-auto" />
                <p>No webhook subscriptions registered.</p>
                <p className="text-[11px] text-slate-400">
                  Receive real-time HTTPS push notifications whenever products are updated, inventory changes, or new orders arrive.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-medium">
                    <tr>
                      <th className="p-2.5">Target Endpoint URL</th>
                      <th className="p-2.5">Subscribed Events</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Created At</th>
                      <th className="p-2.5 text-right">Actions</th>
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
              <label className="block text-slate-500 font-medium">Select Connection</label>
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
              <label className="block text-slate-500 font-medium">Entity Type</label>
              <select
                value={selectedEntityType}
                onChange={(e) => setSelectedEntityType(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-md bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                {['product', 'variant', 'inventory', 'order', 'fulfillment', 'customer'].map((t) => (
                  <option key={t} value={t}>
                    {t.toUpperCase()}
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
              Refresh Mappings
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-600" />
              External-to-Internal Entity Mapping Registry
            </h2>

            {mappings.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No external entity mappings recorded for this connection and entity type.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-medium">
                    <tr>
                      <th className="p-2.5">Mapping ID</th>
                      <th className="p-2.5">Internal ID</th>
                      <th className="p-2.5">External ID</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Direction</th>
                      <th className="p-2.5">Last Synced</th>
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
              Channel Sync Job Log
            </h2>
            <button
              type="button"
              onClick={fetchSyncJobs}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md font-medium inline-flex items-center gap-1 text-xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Jobs
            </button>
          </div>

          {syncJobs.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No channel sync jobs recorded yet for this store.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-medium">
                  <tr>
                    <th className="p-2.5">Job ID</th>
                    <th className="p-2.5">Connection ID</th>
                    <th className="p-2.5">Sync Type</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Processed / Total</th>
                    <th className="p-2.5">Created At</th>
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
                        {job.processed_items} / {job.total_items} {job.failed_items > 0 && <span className="text-rose-600">({job.failed_items} failed)</span>}
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
            <h3 className="text-base font-bold text-slate-900">Add Integration Connection</h3>
            <form onSubmit={handleCreateConnection} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-600 font-medium">Integration Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-800"
                >
                  <option value="salla">Salla Platform</option>
                  <option value="shopify">Shopify Store</option>
                  <option value="woocommerce">WooCommerce Store</option>
                  <option value="easyorders">EasyOrders</option>
                  <option value="custom_api">Custom API Webhook Channel</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-600 font-medium">Connection Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Salla Main Store Sync"
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-md font-medium"
                >
                  Create Connection
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
              Generate API Key
            </h3>

            {createdRawKey ? (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Save your API key securely!
                  </p>
                  <p className="text-[11px]">
                    This secret key will <strong>never be displayed again</strong>. Copy and store it safely in your server environment.
                  </p>
                </div>

                <div className="p-3 bg-slate-900 rounded-md font-mono text-[11px] text-emerald-400 break-all select-all flex items-center justify-between gap-2">
                  <span>{createdRawKey}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(createdRawKey)}
                    className="p-1 hover:bg-slate-800 rounded text-slate-300 transition-colors shrink-0"
                    title="Copy to clipboard"
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
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateApiKey} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="block text-slate-600 font-medium">Key Name / Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ERP Inventory Sync Service"
                    value={apiKeyName}
                    onChange={(e) => setApiKeyName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-slate-600 font-medium">Granted API Scopes</label>
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
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-md font-medium"
                  >
                    Generate Key
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
              Subscribe Real-Time Webhook
            </h3>
            <form onSubmit={handleCreateWebhook} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-600 font-medium">Target Endpoint HTTPS URL</label>
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
                <label className="block text-slate-600 font-medium">Subscribed Events</label>
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-md font-medium"
                >
                  Save Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke API Key Modal */}
      <ConfirmModal
        isOpen={Boolean(revokeKeyId)}
        title="Revoke Developer API Key"
        description="Are you sure you want to revoke this API key? External systems and applications using this key will immediately be denied access."
        confirmLabel="Revoke Key"
        cancelLabel="Keep Key"
        variant="danger"
        loading={isRevoking}
        onConfirm={confirmRevokeApiKey}
        onCancel={() => setRevokeKeyId(null)}
      />

      {/* Delete Webhook Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteWebhookId)}
        title="Delete Webhook Subscription"
        description="Are you sure you want to delete this webhook subscription? Live event push notifications to this destination URL will stop immediately."
        confirmLabel="Delete Webhook"
        cancelLabel="Keep Webhook"
        variant="danger"
        loading={isDeletingWebhook}
        onConfirm={confirmDeleteWebhook}
        onCancel={() => setDeleteWebhookId(null)}
      />
    </div>
  );
}
