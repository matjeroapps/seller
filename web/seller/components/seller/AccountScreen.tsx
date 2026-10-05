'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, IdCard, ShieldCheck, Store, User } from 'lucide-react';

import { sellerClient } from '@/lib/api/client';
import type { SellerProfile } from '@/lib/api/types';
import type { SellerUser } from '@/lib/auth';
import { useSellerShellUser } from '@/components/shell/SellerShellContext';

type AccountScreenProps = {
  user?: SellerUser | null;
};

function getInitials(name?: string | null) {
  return (name || 'Seller')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'S';
}

function formatStatus(value?: string) {
  return value ? value.replace(/[_-]/g, ' ') : 'Unknown';
}

export function AccountScreen({ user }: AccountScreenProps) {
  const shellUser = useSellerShellUser();
  const currentUser = user || shellUser;
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sellerName, setSellerName] = useState('');
  const [phone, setPhone] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      setLoading(true);
      setError(null);
      try {
        const data = await sellerClient.getProfile();
        if (!isMounted) return;
        setProfile(data);
        setSellerName(data.name || '');
        setPhone(data.phone || '');
      } catch (err: unknown) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : 'Failed to load seller profile.';
        setError(
          message === 'Actor authentication required'
            ? 'Your session could not be used to load the seller profile. Refresh the dashboard or sign in again.'
            : message
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) return;

    setSaving(true);
    setSuccessMsg(null);
    setError(null);
    try {
      await sellerClient.updateProfile({
        name: sellerName,
        status: profile.status || 'active',
        phone,
        settings: {
          ...(profile.settings || {}),
          phone
        }
      });
      setProfile((current) =>
        current
          ? {
              ...current,
              name: sellerName,
              phone,
              settings: { ...(current.settings || {}), phone }
            }
          : current
      );
      setSuccessMsg('Seller profile updated successfully.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update seller profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="seller-dashboard">
      <section className="seller-dashboard-hero">
        <div>
          <div className="seller-dashboard-hero__eyebrow">
            <User aria-hidden="true" />
            <span>Profile & account</span>
          </div>
          <div className="seller-dashboard-hero__title-row">
            <h1>{currentUser?.name || 'Seller account'}</h1>
            <span className={`seller-status-badge seller-status-badge--${profile?.status || 'neutral'}`}>
              {formatStatus(profile?.status)}
            </span>
          </div>
          <div className="seller-dashboard-hero__meta">
            <span>{currentUser?.email || 'Email not provided'}</span>
            <span>{currentUser?.roles?.[0] || 'Seller'}</span>
            <span>{profile?.code || 'Seller profile loading'}</span>
          </div>
        </div>
      </section>

      {error && (
        <div className="seller-alert seller-alert--danger" role="alert">
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="seller-alert seller-alert--warning" role="status">
          <CheckCircle2 aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="seller-dashboard__grid">
        <div className="seller-dashboard__main">
          <section className="seller-panel">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">MatjerHub SSO</span>
                <h2>Account identity</h2>
              </div>
              <ShieldCheck aria-hidden="true" />
            </div>

            <div className="seller-account-identity">
              <div className="seller-account-avatar">{getInitials(currentUser?.name)}</div>
              <div>
                <strong>{currentUser?.name || 'Signed-in seller'}</strong>
                <span>{currentUser?.email || 'No email address on the active session'}</span>
              </div>
            </div>

            <div className="seller-account-details">
              <div>
                <span>Account subject ID</span>
                <strong>{currentUser?.id || 'Sign in again to refresh the account subject'}</strong>
              </div>
              <div>
                <span>Assigned roles</span>
                <div className="seller-role-list">
                  {(currentUser?.roles?.length ? currentUser.roles : ['seller']).map((role) => (
                    <em key={role}>{role}</em>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <form onSubmit={handleSave} className="seller-panel">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">Seller profile</span>
                <h2>Business display details</h2>
              </div>
              <Store aria-hidden="true" />
            </div>

            {loading ? (
              <div className="seller-inline-empty">Loading seller profile...</div>
            ) : !profile ? (
              <div className="seller-profile-reconnect">
                <p>
                  Seller profile details could not be loaded for this browser session. Refresh the dashboard, or sign in again
                  to reconnect profile editing.
                </p>
                <button
                  type="button"
                  className="seller-secondary-link"
                  onClick={() => {
                    window.location.href = '/logout';
                  }}
                >
                  Sign in again
                </button>
              </div>
            ) : (
              <>
                <div className="seller-form-grid">
                  <label>
                    <span>Seller profile ID</span>
                    <input type="text" readOnly value={profile.id} />
                  </label>
                  <label>
                    <span>Seller code</span>
                    <input type="text" readOnly value={profile.code || ''} />
                  </label>
                  <label>
                    <span>Business display name</span>
                    <input
                      type="text"
                      required
                      value={sellerName}
                      onChange={(event) => setSellerName(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Support phone</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+966500000000"
                    />
                  </label>
                </div>

                <div className="seller-form-actions">
                  <button type="submit" className="seller-primary-action" disabled={saving || !profile}>
                    {saving ? 'Saving...' : 'Save profile changes'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>

        <aside className="seller-dashboard__rail">
          <section className="seller-panel">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">Security</span>
                <h2>Managed by MatjerHub SSO</h2>
              </div>
              <IdCard aria-hidden="true" />
            </div>
            <p className="seller-account-note">
              Passwords, multi-factor authentication, passkeys, and active session policies are controlled by MatjerHub SSO.
              Use the SSO account flow when you need to change identity security settings.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
