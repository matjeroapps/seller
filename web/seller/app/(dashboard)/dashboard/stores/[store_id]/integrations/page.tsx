'use client';

import { useEffect, useState, use } from 'react';
import { Link2, Plus, RefreshCw, CheckCircle2, AlertCircle, Layers } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { IntegrationConnection, ExternalEntityMapping } from '@/lib/api/types';

export default function StoreIntegrationsPage({
  params
}: {
  params: Promise<{ store_id: string }>;
}) {
  const { store_id } = use(params);

  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [mappings, setMappings] = useState<ExternalEntityMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'CONNECTIONS' | 'MAPPINGS'>('CONNECTIONS');
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('product');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [provider, setProvider] = useState<string>('salla');
  const [connectionName, setConnectionName] = useState<string>('');

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

  useEffect(() => {
    fetchConnections();
  }, [store_id]);

  useEffect(() => {
    if (activeTab === 'MAPPINGS' && selectedConnection) {
      fetchMappings();
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

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">External Integration Foundation</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage provider sync connections (Salla, Shopify, WooCommerce, EasyOrders, Custom API) and inspect entity mapping status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowConnectModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Integration Connection
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {(['CONNECTIONS', 'MAPPINGS'] as const).map((tab) => (
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
            {tab}
          </button>
        ))}
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="p-8 bg-white border border-slate-200 rounded-lg text-xs text-slate-500 animate-pulse">
          Loading integration channels...
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
                  <span>Connected: {new Date(conn.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
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
    </div>
  );
}
