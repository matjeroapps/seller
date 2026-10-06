import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ShipmentsOverviewScreen } from '../components/seller/ShipmentsOverviewScreen';
import { OrderDocumentsScreen } from '../components/seller/OrderDocumentsScreen';
import { SettingsScreen } from '../components/seller/SettingsScreen';
import { AccountScreen } from '../components/seller/AccountScreen';
import { getNavigationForStore } from '../config/seller-navigation';
import { sellerClient } from '../lib/api/client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  }),
  usePathname: () => '/dashboard/stores/str_1'
}));

const { mockClient } = vi.hoisted(() => {
  const mockClient = {
    listStoreOrders: vi.fn(),
    listStoreShipments: vi.fn(),
    createStoreShipment: vi.fn(),
    getStoreOrderDetail: vi.fn(),
    getStores: vi.fn(),
    getStoreOperationalState: vi.fn(),
    updateStoreOperationalState: vi.fn(),
    getProfile: vi.fn(),
    updateProfile: vi.fn()
  };
  return { mockClient };
});

vi.mock('../lib/api/client', () => ({
  sellerClient: mockClient,
  sellerApi: mockClient
}));

describe('SDS-3, SDS-4 & SDS-5 Completion Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SDS-3 Operations & Fulfillment', () => {
    it('renders ShipmentsOverviewScreen with shipments queue and status filter', async () => {
      vi.mocked(sellerClient.listStoreShipments).mockResolvedValue({
        items: [
          {
            id: 'shp_1',
            order_id: 'ord_1',
            fulfillment_location_id: 'loc_1',
            status: 'PENDING',
            carrier_name: 'SMSA Express',
            tracking_number: 'TRK-ORD-1001-abc',
            shipping_cost_minor: 2500,
            cod_amount_minor: 0,
            currency: 'SAR',
            items: [],
            created_at: '2026-10-02T10:00:00Z',
            updated_at: '2026-10-02T10:00:00Z'
          }
        ],
        total_count: 1,
        page: 1,
        page_size: 25
      });

      render(<ShipmentsOverviewScreen storeId="str_1" />);

      await waitFor(() => {
        expect(screen.getByText('Store Shipments Queue')).toBeInTheDocument();
        expect(screen.getByText(/TRK-ORD-1001-abc/i)).toBeInTheDocument();
        expect(screen.getByText(/SMSA Express/i)).toBeInTheDocument();
      });
    });

    it('renders OrderDocumentsScreen with printable receipt and partial ZATCA export notice', async () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      vi.mocked(sellerClient.getStoreOrderDetail).mockResolvedValue({
        id: 'ord_101',
        order_number: 'ORD-2002',
        status: 'confirmed',
        currency: 'SAR',
        subtotal: 20000,
        total: 22000,
        item_count: 1,
        contact_email: 'customer@example.com',
        shipping_address: {
          recipient_name: 'Sara Ahmed',
          address_line_1: 'Olaya St',
          city: 'Riyadh',
          country_code: 'SA'
        },
        items: [],
        timeline: [],
        allowed_next_actions: [],
        created_at: '2026-10-01T12:00:00Z',
        updated_at: '2026-10-01T12:00:00Z'
      });

      render(<OrderDocumentsScreen storeId="str_1" orderId="ord_101" />);

      await waitFor(() => {
        expect(screen.getByText(/Order Documents #ORD-2002/i)).toBeInTheDocument();
        expect(screen.getByText(/PACKING SLIP & RECEIPT/i)).toBeInTheDocument();
        expect(screen.getByText(/ZATCA E-Invoicing Signing/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Print Document'));
      expect(printSpy).toHaveBeenCalled();
      printSpy.mockRestore();
    });
  });

  describe('SDS-4 Store Administration & SSO', () => {
    it('renders SettingsScreen store profile and handles checkout pause toggle', async () => {
      vi.mocked(sellerClient.getStores).mockResolvedValue({
        items: [
          { id: 'str_1', seller_id: 'slr_1', name: 'Alpha Retail Store', code: 'alpha-store', market_code: 'SA', status: 'active', created_at: '', updated_at: '' }
        ],
        active_store_limit: 5,
        active_store_count: 1
      });
      vi.mocked(sellerClient.getStoreOperationalState).mockResolvedValue({
        store_id: 'str_1',
        checkout_status: 'accepting',
        checkout_accepting: true,
        maintenance_message: '',
        updated_at: '2026-10-01T10:00:00Z'
      });
      vi.mocked(sellerClient.updateStoreOperationalState).mockResolvedValue({
        store_id: 'str_1',
        checkout_status: 'paused',
        checkout_accepting: false,
        maintenance_message: 'Checkout paused for inventory audit.',
        updated_at: '2026-10-02T10:00:00Z'
      });

      render(<SettingsScreen storeId="str_1" />);

      await waitFor(() => {
        expect(screen.getAllByText('Alpha Retail Store').length).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: /Pause checkout/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Pause checkout/i }));

      await waitFor(() => {
        expect(sellerClient.updateStoreOperationalState).toHaveBeenCalledWith('str_1', expect.objectContaining({
          checkout_status: 'paused'
        }));
      });
    });

    it('renders AccountScreen with MatjerHub SSO security notice and profile form', async () => {
      vi.mocked(sellerClient.getProfile).mockResolvedValue({
        id: 'prof_1',
        name: 'MatjerHub Admin',
        code: 'SELLER-001',
        status: 'active',
        phone: '+966500000000',
        roles: ['seller_owner'],
        created_at: '2026-10-01'
      });

      render(<AccountScreen user={{ id: 'usr_sso_1', name: 'MatjerHub Admin', email: 'admin@matjerhub.com', roles: ['seller_owner'] }} />);

      await waitFor(() => {
        expect(screen.getAllByText('MatjerHub Admin').length).toBeGreaterThan(0);
        expect(screen.getByText('Managed by MatjerHub SSO')).toBeInTheDocument();
        expect(screen.getByText(/controlled by MatjerHub SSO/i)).toBeInTheDocument();
      });
    });

    it('omits unavailable team route from primary store settings navigation', () => {
      const navItems = getNavigationForStore('str_1');
      const settingsNav = navItems.find((item) => item.id === 'settings');

      expect(settingsNav).toBeDefined();
      const childPaths = settingsNav?.children?.map((child) => child.path) || [];

      expect(childPaths).toContain('/dashboard/stores/str_1/settings');
      expect(childPaths).toContain('/dashboard/stores/str_1/account');
      expect(childPaths).not.toContain('/dashboard/stores/str_1/users');
    });
  });
});
