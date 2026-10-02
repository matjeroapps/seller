'use client';

import React, { useEffect, useState } from 'react';
import { sellerClient } from '@/lib/api/client';
import type { SellerProfile } from '@/lib/api/types';
import { CapabilityState } from './CapabilityState';
import { createUnavailableState } from '@/lib/screens/state';
import { User, Shield, KeyRound, Smartphone } from 'lucide-react';

export function AccountScreen() {
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sellerClient.getProfile();
      setProfile(data);
      setName(data.name || '');
      setPhone(data.phone || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load seller profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setError(null);
    try {
      const updated = await sellerClient.updateProfile({ name, phone });
      setProfile(updated);
      setSuccessMsg('Profile updated successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <CapabilityState
        state={{
          status: 'loading',
          title: 'Loading Account Profile',
          description: 'Fetching user details and security preferences...',
        }}
      />
    );
  }

  const securityState = createUnavailableState(
    '2FA, Passkeys & Session Revocation',
    'Two-Factor Authentication, Passkey management, and active session termination are managed directly by your Identity Provider (ZITADEL).'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Account Profile</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage your personal details and view identity security settings.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 p-4 border border-rose-200 text-sm text-rose-700">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-md bg-emerald-50 p-4 border border-emerald-200 text-sm text-emerald-700">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="rounded-lg border bg-white p-6 shadow-sm dark:bg-slate-900 space-y-4">
        <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white border-b pb-3">
          <User className="h-5 w-5 text-primary-600" />
          Personal Information
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Account Subject ID</label>
            <input
              type="text"
              readOnly
              value={profile?.id || ''}
              className="mt-1 block w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Email Address</label>
            <input
              type="text"
              readOnly
              value={profile?.email || ''}
              className="mt-1 block w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+966500000000"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Assigned Roles</label>
          <div className="flex flex-wrap gap-2">
            {profile?.roles?.map((role) => (
              <span
                key={role}
                className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-200"
              >
                {role}
              </span>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>

      <CapabilityState state={securityState} />
    </div>
  );
}
