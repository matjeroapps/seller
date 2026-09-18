'use client';

import { useEffect, useState, use } from 'react';
import { DollarSign, Wallet, FileText, ArrowUpRight, Scale, CreditCard } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { StoreBalance, LedgerEntry, Settlement, Payout } from '@/lib/api/types';

export default function StoreFinancePage({
  params
}: {
  params: Promise<{ store_id: string }>;
}) {
  const { store_id } = use(params);

  const [balance, setBalance] = useState<StoreBalance | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LEDGER' | 'SETTLEMENTS' | 'PAYOUTS'>('OVERVIEW');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      sellerApi.getStoreBalance(store_id).catch(() => null),
      sellerApi.listStoreLedgerEntries(store_id).catch(() => ({ items: [] })),
      sellerApi.listStoreSettlements(store_id).catch(() => ({ items: [] })),
      sellerApi.listStorePayouts(store_id).catch(() => ({ items: [] }))
    ]).then(([balRes, ledgerRes, settlementRes, payoutRes]) => {
      setBalance(balRes);
      setLedgerEntries(ledgerRes?.items || []);
      setSettlements(settlementRes?.items || []);
      setPayouts(payoutRes?.items || []);
      setLoading(false);
    });
  }, [store_id]);

  const formatMoney = (amountMinor: number, currency: string = 'SAR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amountMinor / 100);
  };

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Financial Ledger & Settlement Operations</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          View store balances, double-entry financial ledger transactions, settlement calculations, and payout disbursements.
        </p>
      </div>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Available Balance</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {balance ? formatMoney(balance.available_minor, balance.currency) : 'SAR 0.00'}
          </div>
          <p className="text-[11px] text-slate-400">Available for immediate payout disbursement</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Pending Balance</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {balance ? formatMoney(balance.pending_minor, balance.currency) : 'SAR 0.00'}
          </div>
          <p className="text-[11px] text-slate-400">In-flight settlements awaiting finalization</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Journal Entries</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{ledgerEntries.length}</div>
          <p className="text-[11px] text-slate-400">Immutable double-entry transaction records</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {(['OVERVIEW', 'LEDGER', 'SETTLEMENTS', 'PAYOUTS'] as const).map((tab) => (
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
          Loading financial records...
        </div>
      ) : (
        <>
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-slate-600" />
                  Recent Double-Entry Ledger Transactions
                </h2>
                {ledgerEntries.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No ledger transaction entries posted yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {ledgerEntries.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-medium text-slate-800">{entry.description || entry.reference_type}</div>
                          <div className="text-[11px] text-slate-400">Ref: {entry.reference_id}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-slate-900">{formatMoney(0, entry.currency)}</div>
                          <div className="text-[10px] text-slate-400">{new Date(entry.posted_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'LEDGER' && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-600" />
                Immutable Ledger Journal
              </h2>
              {ledgerEntries.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">No journal entries recorded.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 font-medium">
                      <tr>
                        <th className="p-2.5">Entry ID</th>
                        <th className="p-2.5">Reference Type</th>
                        <th className="p-2.5">Reference ID</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5">Posted At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledgerEntries.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-[11px]">{e.id}</td>
                          <td className="p-2.5">{e.reference_type}</td>
                          <td className="p-2.5 font-mono text-[11px]">{e.reference_id}</td>
                          <td className="p-2.5">{e.description || '-'}</td>
                          <td className="p-2.5 text-slate-400">{new Date(e.posted_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'SETTLEMENTS' && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-slate-600" />
                Settlement Statements
              </h2>
              {settlements.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">No settlement statements finalized for this store.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 font-medium">
                      <tr>
                        <th className="p-2.5">Settlement ID</th>
                        <th className="p-2.5">Period</th>
                        <th className="p-2.5">Gross Amount</th>
                        <th className="p-2.5">Adjustments</th>
                        <th className="p-2.5">Net Settlement</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {settlements.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-[11px]">{s.id}</td>
                          <td className="p-2.5">{s.settlement_period_id}</td>
                          <td className="p-2.5">{formatMoney(s.gross_amount_minor, s.currency)}</td>
                          <td className="p-2.5">{formatMoney(s.adjustment_amount_minor, s.currency)}</td>
                          <td className="p-2.5 font-semibold text-slate-900">{formatMoney(s.net_amount_minor, s.currency)}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'PAYOUTS' && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-600" />
                Payout Disbursements
              </h2>
              {payouts.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">No payout disbursements processed yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 font-medium">
                      <tr>
                        <th className="p-2.5">Payout ID</th>
                        <th className="p-2.5">Amount</th>
                        <th className="p-2.5">Method</th>
                        <th className="p-2.5">Reference</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Disbursed At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payouts.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-[11px]">{p.id}</td>
                          <td className="p-2.5 font-semibold text-slate-900">{formatMoney(p.amount_minor, p.currency)}</td>
                          <td className="p-2.5">{p.payout_method}</td>
                          <td className="p-2.5 font-mono text-[11px]">{p.reference || '-'}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              {p.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-400">{new Date(p.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
