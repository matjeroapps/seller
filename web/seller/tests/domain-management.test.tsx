import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { DomainManagementPanel } from '../src/components/DomainManagementPanel';
import type { ApiClient } from '../src/lib/api';
import type { StoreDomain } from '../src/types/domains';
import { messages } from '../src/i18n/locales';

const mockCopy = messages.en;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createMockApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    listStoreDomains: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'dom-plat',
          domain: 'store-1.matjero.com',
          is_primary: true,
          status: 'active',
          domain_type: 'platform',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z'
        }
      ]
    }),
    requestCustomDomain: vi.fn(),
    verifyCustomDomain: vi.fn(),
    activateCustomDomain: vi.fn(),
    getStorefrontHost: vi.fn().mockResolvedValue({ host: 'store-1.matjero.com' }),
    ...overrides
  } as unknown as ApiClient;
}

describe('DomainManagementPanel', () => {
  it('renders platform domain as read-only with no verify or activate actions', async () => {
    const api = createMockApi();
    render(<DomainManagementPanel api={api} storeId="store-1" locale="en" copy={mockCopy} />);

    await waitFor(() => {
      expect(screen.getAllByText('store-1.matjero.com')[0]).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /check verification/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /activate domain/i })).not.toBeInTheDocument();
  });

  it('renders disabled platform domain with administrative moderation notice and no actions', async () => {
    const disabledPlatformDomain: StoreDomain = {
      id: 'dom-plat-disabled',
      domain: 'disabled-store.matjero.com',
      is_primary: false,
      status: 'disabled',
      domain_type: 'platform',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    };

    const api = createMockApi({
      listStoreDomains: vi.fn().mockResolvedValue({ items: [disabledPlatformDomain] })
    });

    render(<DomainManagementPanel api={api} storeId="store-1" locale="en" copy={mockCopy} />);

    await waitFor(() => {
      expect(screen.getByText('disabled-store.matjero.com')).toBeInTheDocument();
    });

    expect(screen.getByText('Disabled by Admin')).toBeInTheDocument();
    expect(screen.getByText(/disabled by platform administration/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /check verification/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /activate domain/i })).not.toBeInTheDocument();
  });

  it('handles add custom domain request flow and renders TXT instructions directly from API response', async () => {
    const pendingDomain: StoreDomain = {
      id: 'dom-cust-1',
      domain: 'shop.example.com',
      is_primary: false,
      status: 'pending',
      domain_type: 'custom',
      verification: {
        record_type: 'TXT',
        record_name: '_matjero-verification.shop.example.com',
        record_value: 'matjero-verification=secret-from-server-123'
      },
      created_at: '2026-01-02T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z'
    };

    const api = createMockApi({
      requestCustomDomain: vi.fn().mockResolvedValue(pendingDomain),
      listStoreDomains: vi.fn()
        .mockResolvedValueOnce({
          items: [
            {
              id: 'dom-plat',
              domain: 'store-1.matjero.com',
              is_primary: true,
              status: 'active',
              domain_type: 'platform',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z'
            }
          ]
        })
        .mockResolvedValueOnce({
          items: [
            {
              id: 'dom-plat',
              domain: 'store-1.matjero.com',
              is_primary: true,
              status: 'active',
              domain_type: 'platform',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z'
            },
            pendingDomain
          ]
        })
    });

    render(<DomainManagementPanel api={api} storeId="store-1" locale="en" copy={mockCopy} />);

    await waitFor(() => {
      expect(screen.getAllByText('store-1.matjero.com')[0]).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/custom domain hostname/i);
    fireEvent.change(input, { target: { value: 'shop.example.com' } });

    const submitBtn = screen.getByRole('button', { name: /request custom domain/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.requestCustomDomain).toHaveBeenCalledWith('store-1', 'shop.example.com');
    });

    await waitFor(() => {
      expect(screen.getByText('_matjero-verification.shop.example.com')).toBeInTheDocument();
      expect(screen.getByText('matjero-verification=secret-from-server-123')).toBeInTheDocument();
    });
  });

  it('handles verification success flow', async () => {
    const pendingDomain: StoreDomain = {
      id: 'dom-cust-1',
      domain: 'shop.example.com',
      is_primary: false,
      status: 'pending',
      domain_type: 'custom',
      verification: {
        record_type: 'TXT',
        record_name: '_matjero-verification.shop.example.com',
        record_value: 'matjero-verification=secret-from-server-123'
      },
      created_at: '2026-01-02T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z'
    };

    const verifiedDomain: StoreDomain = {
      ...pendingDomain,
      status: 'verified'
    };

    const api = createMockApi({
      verifyCustomDomain: vi.fn().mockResolvedValue(verifiedDomain),
      listStoreDomains: vi.fn()
        .mockResolvedValueOnce({ items: [pendingDomain] })
        .mockResolvedValueOnce({ items: [verifiedDomain] })
    });

    render(<DomainManagementPanel api={api} storeId="store-1" locale="en" copy={mockCopy} />);

    await waitFor(() => {
      expect(screen.getByText('shop.example.com')).toBeInTheDocument();
    });

    const verifyBtn = screen.getByRole('button', { name: /check verification/i });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(api.verifyCustomDomain).toHaveBeenCalledWith('store-1', 'dom-cust-1');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /activate domain/i })).toBeInTheDocument();
    });
  });

  it('handles verification failure flow gracefully without crashing and allows retry', async () => {
    const pendingDomain: StoreDomain = {
      id: 'dom-cust-1',
      domain: 'shop.example.com',
      is_primary: false,
      status: 'pending',
      domain_type: 'custom',
      verification: {
        record_type: 'TXT',
        record_name: '_matjero-verification.shop.example.com',
        record_value: 'matjero-verification=secret-from-server-123'
      },
      created_at: '2026-01-02T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z'
    };

    const failedDomain: StoreDomain = {
      ...pendingDomain,
      status: 'failed'
    };

    const api = createMockApi({
      verifyCustomDomain: vi.fn().mockResolvedValue(failedDomain),
      listStoreDomains: vi.fn()
        .mockResolvedValueOnce({ items: [pendingDomain] })
        .mockResolvedValueOnce({ items: [failedDomain] })
    });

    render(<DomainManagementPanel api={api} storeId="store-1" locale="en" copy={mockCopy} />);

    await waitFor(() => {
      expect(screen.getByText('shop.example.com')).toBeInTheDocument();
    });

    const verifyBtn = screen.getByRole('button', { name: /check verification/i });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(screen.getByText(/TXT record not found or not matching yet/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /check verification/i })).toBeInTheDocument();
  });

  it('differentiates 503 DNS failure from domain failure without mutating local status', async () => {
    const pendingDomain: StoreDomain = {
      id: 'dom-cust-1',
      domain: 'shop.example.com',
      is_primary: false,
      status: 'pending',
      domain_type: 'custom',
      verification: {
        record_type: 'TXT',
        record_name: '_matjero-verification.shop.example.com',
        record_value: 'matjero-verification=secret-from-server-123'
      },
      created_at: '2026-01-02T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z'
    };

    const err503 = new Error('Service Unavailable');
    (err503 as any).status = 503;
    (err503 as any).code = 'service_unavailable';

    const api = createMockApi({
      verifyCustomDomain: vi.fn().mockRejectedValue(err503),
      listStoreDomains: vi.fn().mockResolvedValue({ items: [pendingDomain] })
    });

    render(<DomainManagementPanel api={api} storeId="store-1" locale="en" copy={mockCopy} />);

    await waitFor(() => {
      expect(screen.getByText('shop.example.com')).toBeInTheDocument();
    });

    const verifyBtn = screen.getByRole('button', { name: /check verification/i });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Verification service is temporarily unavailable/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Pending Verification')).toBeInTheDocument();
  });

  it('handles custom domain activation and reflects custom active primary and platform active secondary', async () => {
    const platformDomain: StoreDomain = {
      id: 'dom-plat',
      domain: 'store-1.matjero.com',
      is_primary: true,
      status: 'active',
      domain_type: 'platform',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    };

    const verifiedDomain: StoreDomain = {
      id: 'dom-cust-1',
      domain: 'shop.example.com',
      is_primary: false,
      status: 'verified',
      domain_type: 'custom',
      created_at: '2026-01-02T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z'
    };

    const activatedDomain: StoreDomain = {
      ...verifiedDomain,
      status: 'active',
      is_primary: true
    };

    const platformSecondary: StoreDomain = {
      ...platformDomain,
      is_primary: false
    };

    const api = createMockApi({
      activateCustomDomain: vi.fn().mockResolvedValue(activatedDomain),
      listStoreDomains: vi.fn()
        .mockResolvedValueOnce({ items: [platformDomain, verifiedDomain] })
        .mockResolvedValueOnce({ items: [platformSecondary, activatedDomain] }),
      getStorefrontHost: vi.fn()
        .mockResolvedValueOnce({ host: 'store-1.matjero.com' })
        .mockResolvedValueOnce({ host: 'shop.example.com' })
    });

    render(<DomainManagementPanel api={api} storeId="store-1" locale="en" copy={mockCopy} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /activate domain/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /activate domain/i }));

    await waitFor(() => {
      expect(screen.getByText(/Activate Custom Primary Domain/i)).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /activate primary/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.activateCustomDomain).toHaveBeenCalledWith('store-1', 'dom-cust-1');
    });

    await waitFor(() => {
      expect(screen.getAllByText('shop.example.com')[0]).toBeInTheDocument();
    });
  });

  it('renders disabled state with no verify or activate buttons and displays moderation lock notice', async () => {
    const disabledDomain: StoreDomain = {
      id: 'dom-cust-disabled',
      domain: 'banned.example.com',
      is_primary: false,
      status: 'disabled',
      domain_type: 'custom',
      created_at: '2026-01-02T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z'
    };

    const api = createMockApi({
      listStoreDomains: vi.fn().mockResolvedValue({ items: [disabledDomain] })
    });

    render(<DomainManagementPanel api={api} storeId="store-1" locale="en" copy={mockCopy} />);

    await waitFor(() => {
      expect(screen.getByText('banned.example.com')).toBeInTheDocument();
    });

    expect(screen.getByText('Disabled by Admin')).toBeInTheDocument();
    expect(screen.getByText(/disabled by platform administration/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /check verification/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /activate domain/i })).not.toBeInTheDocument();
  });

  it('clears state and challenge when switching stores', async () => {
    const storeADomain: StoreDomain = {
      id: 'dom-a',
      domain: 'store-a.example.com',
      is_primary: false,
      status: 'pending',
      domain_type: 'custom',
      verification: {
        record_type: 'TXT',
        record_name: '_matjero-verification.store-a.example.com',
        record_value: 'matjero-verification=challenge-a'
      },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    };

    const storeBDomain: StoreDomain = {
      id: 'dom-b',
      domain: 'store-b.example.com',
      is_primary: false,
      status: 'pending',
      domain_type: 'custom',
      verification: {
        record_type: 'TXT',
        record_name: '_matjero-verification.store-b.example.com',
        record_value: 'matjero-verification=challenge-b'
      },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    };

    const api = createMockApi({
      listStoreDomains: vi.fn().mockImplementation((sId: string) => {
        if (sId === 'store-a') return Promise.resolve({ items: [storeADomain] });
        if (sId === 'store-b') return Promise.resolve({ items: [storeBDomain] });
        return Promise.resolve({ items: [] });
      })
    });

    const { rerender } = render(<DomainManagementPanel api={api} storeId="store-a" locale="en" copy={mockCopy} />);

    await waitFor(() => {
      expect(screen.getByText('store-a.example.com')).toBeInTheDocument();
      expect(screen.getByText('matjero-verification=challenge-a')).toBeInTheDocument();
    });

    rerender(<DomainManagementPanel api={api} storeId="store-b" locale="en" copy={mockCopy} />);

    await waitFor(() => {
      expect(screen.getByText('store-b.example.com')).toBeInTheDocument();
      expect(screen.getByText('matjero-verification=challenge-b')).toBeInTheDocument();
    });

    expect(screen.queryByText('store-a.example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('matjero-verification=challenge-a')).not.toBeInTheDocument();
  });

  // --- MANDATORY DETERMINISTIC ASYNC ISOLATION REGRESSION TESTS ---

  it('guards against out-of-order list loads when switching stores before Store A finishes', async () => {
    const storeADeferred = createDeferred<{ items: StoreDomain[] }>();

    const storeBDomain: StoreDomain = {
      id: 'dom-b',
      domain: 'store-b.example.com',
      is_primary: false,
      status: 'pending',
      domain_type: 'custom',
      verification: {
        record_type: 'TXT',
        record_name: '_matjero-verification.store-b.example.com',
        record_value: 'matjero-verification=challenge-b'
      },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    };

    const api = createMockApi({
      listStoreDomains: vi.fn().mockImplementation((sId: string) => {
        if (sId === 'store-a') return storeADeferred.promise;
        if (sId === 'store-b') return Promise.resolve({ items: [storeBDomain] });
        return Promise.resolve({ items: [] });
      })
    });

    // 1. Render Store A -> load stays pending
    const { rerender } = render(<DomainManagementPanel api={api} storeId="store-a" locale="en" copy={mockCopy} />);

    // 2. Immediately switch to Store B -> Store B resolves
    rerender(<DomainManagementPanel api={api} storeId="store-b" locale="en" copy={mockCopy} />);

    await waitFor(() => {
      expect(screen.getByText('store-b.example.com')).toBeInTheDocument();
      expect(screen.getByText('matjero-verification=challenge-b')).toBeInTheDocument();
    });

    // 3. Now resolve the old Store A request with Store A challenge
    await act(async () => {
      storeADeferred.resolve({
        items: [
          {
            id: 'dom-a',
            domain: 'store-a.example.com',
            is_primary: false,
            status: 'pending',
            domain_type: 'custom',
            verification: {
              record_type: 'TXT',
              record_name: '_matjero-verification.store-a.example.com',
              record_value: 'matjero-verification=challenge-a'
            },
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z'
          }
        ]
      });
    });

    // 4. Assert Store B is still shown and Store A data is completely ignored
    expect(screen.getByText('store-b.example.com')).toBeInTheDocument();
    expect(screen.getByText('matjero-verification=challenge-b')).toBeInTheDocument();
    expect(screen.queryByText('store-a.example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('matjero-verification=challenge-a')).not.toBeInTheDocument();
  });

  it('guards against in-flight verify requests when switching stores', async () => {
    const storeADomain: StoreDomain = {
      id: 'dom-a',
      domain: 'store-a.example.com',
      is_primary: false,
      status: 'pending',
      domain_type: 'custom',
      verification: {
        record_type: 'TXT',
        record_name: '_matjero-verification.store-a.example.com',
        record_value: 'matjero-verification=challenge-a'
      },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    };

    const storeBDomain: StoreDomain = {
      id: 'dom-b',
      domain: 'store-b.example.com',
      is_primary: false,
      status: 'pending',
      domain_type: 'custom',
      verification: {
        record_type: 'TXT',
        record_name: '_matjero-verification.store-b.example.com',
        record_value: 'matjero-verification=challenge-b'
      },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    };

    const verifyDeferred = createDeferred<StoreDomain>();

    const api = createMockApi({
      listStoreDomains: vi.fn().mockImplementation((sId: string) => {
        if (sId === 'store-a') return Promise.resolve({ items: [storeADomain] });
        if (sId === 'store-b') return Promise.resolve({ items: [storeBDomain] });
        return Promise.resolve({ items: [] });
      }),
      verifyCustomDomain: vi.fn().mockReturnValue(verifyDeferred.promise)
    });

    const { rerender } = render(<DomainManagementPanel api={api} storeId="store-a" locale="en" copy={mockCopy} />);

    await waitFor(() => {
      expect(screen.getByText('store-a.example.com')).toBeInTheDocument();
    });

    // Trigger verify on Store A
    const verifyBtn = screen.getByRole('button', { name: /check verification/i });
    fireEvent.click(verifyBtn);

    // Switch to Store B while verify is in-flight
    rerender(<DomainManagementPanel api={api} storeId="store-b" locale="en" copy={mockCopy} />);

    await waitFor(() => {
      expect(screen.getByText('store-b.example.com')).toBeInTheDocument();
    });

    // Resolve old Store A verify call
    await act(async () => {
      verifyDeferred.resolve({
        ...storeADomain,
        status: 'verified'
      });
    });

    // Store B remains active and no Store A notice or challenge leaks
    expect(screen.getByText('store-b.example.com')).toBeInTheDocument();
    expect(screen.getByText('matjero-verification=challenge-b')).toBeInTheDocument();
    expect(screen.queryByText('store-a.example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('matjero-verification=challenge-a')).not.toBeInTheDocument();
  });

  it('guards against in-flight activate requests when switching stores', async () => {
    const storeADomain: StoreDomain = {
      id: 'dom-a',
      domain: 'store-a.example.com',
      is_primary: false,
      status: 'verified',
      domain_type: 'custom',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    };

    const storeBDomain: StoreDomain = {
      id: 'dom-b',
      domain: 'store-b.example.com',
      is_primary: false,
      status: 'pending',
      domain_type: 'custom',
      verification: {
        record_type: 'TXT',
        record_name: '_matjero-verification.store-b.example.com',
        record_value: 'matjero-verification=challenge-b'
      },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    };

    const activateDeferred = createDeferred<StoreDomain>();

    const api = createMockApi({
      listStoreDomains: vi.fn().mockImplementation((sId: string) => {
        if (sId === 'store-a') return Promise.resolve({ items: [storeADomain] });
        if (sId === 'store-b') return Promise.resolve({ items: [storeBDomain] });
        return Promise.resolve({ items: [] });
      }),
      activateCustomDomain: vi.fn().mockReturnValue(activateDeferred.promise)
    });

    const { rerender } = render(<DomainManagementPanel api={api} storeId="store-a" locale="en" copy={mockCopy} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /activate domain/i })).toBeInTheDocument();
    });

    // Open modal and click confirm activate on Store A
    fireEvent.click(screen.getByRole('button', { name: /activate domain/i }));
    await waitFor(() => {
      expect(screen.getByText(/Activate Custom Primary Domain/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /activate primary/i }));

    // Immediately switch to Store B before activate resolves
    rerender(<DomainManagementPanel api={api} storeId="store-b" locale="en" copy={mockCopy} />);

    await waitFor(() => {
      expect(screen.getByText('store-b.example.com')).toBeInTheDocument();
    });

    // Resolve old Store A activation call
    await act(async () => {
      activateDeferred.resolve({
        ...storeADomain,
        status: 'active',
        is_primary: true
      });
    });

    // Store B remains active and no Store A success message leaks
    expect(screen.getByText('store-b.example.com')).toBeInTheDocument();
    expect(screen.queryByText('store-a.example.com')).not.toBeInTheDocument();
  });
});
