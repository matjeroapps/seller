import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sellerClient } from '../lib/api/client';

describe('Seller API Client Contracts & Envelope Integrity (T013)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches seller profile correctly via getProfile', async () => {
    const mockProfile = {
      id: 'usr_seller_a_owner',
      email: 'owner-a@matjerhub.test',
      name: 'Seller A Owner',
      roles: ['seller_owner'],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
      expect(String(url)).toContain('/v1/seller/profile');
      return new Response(JSON.stringify(mockProfile), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const profile = await sellerClient.getProfile();
    expect(profile.id).toBe('usr_seller_a_owner');
    expect(profile.name).toBe('Seller A Owner');
    expect(profile.roles).toContain('seller_owner');
  });

  it('updates seller profile via updateProfile', async () => {
    const updatedProfile = {
      id: 'usr_seller_a_owner',
      email: 'owner-a@matjerhub.test',
      name: 'New Owner Name',
      phone: '+966500000000',
      roles: ['seller_owner'],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url, init) => {
      expect(String(url)).toContain('/v1/seller/profile');
      expect(init?.method).toBe('PUT');
      expect(JSON.parse(init?.body as string)).toEqual({ name: 'New Owner Name', phone: '+966500000000' });
      return new Response(JSON.stringify(updatedProfile), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const result = await sellerClient.updateProfile({ name: 'New Owner Name', phone: '+966500000000' });
    expect(result.name).toBe('New Owner Name');
    expect(result.phone).toBe('+966500000000');
  });

  it('throws typed error on API failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return new Response(JSON.stringify({ error: 'unauthorized', message: 'Token expired' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    });

    await expect(sellerClient.getProfile()).rejects.toThrow('Token expired');
  });
});
