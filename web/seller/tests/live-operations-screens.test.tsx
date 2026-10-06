import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccountScreen } from '../components/seller/AccountScreen';
import { SettingsScreen } from '../components/seller/SettingsScreen';
import { ShipmentsOverviewScreen } from '../components/seller/ShipmentsOverviewScreen';
import { TeamScreen } from '../components/seller/TeamScreen';
import { OrderDocumentsScreen } from '../components/seller/OrderDocumentsScreen';
import { SellerShellUserProvider } from '../components/shell/SellerShellContext';
import { sellerClient } from '../lib/api/client';

describe('Live & Operations Screens Verification (T020)', () => {
  it('renders AccountScreen title and form', async () => {
    vi.spyOn(sellerClient, 'getProfile').mockResolvedValueOnce({
      id: 'usr_seller_a_owner',
      code: 'merchant-demo',
      name: 'Seller Owner',
      status: 'active',
      phone: '+966500000000',
      roles: ['seller_owner'],
      settings: { phone: '+966500000000' },
    });

    render(
      <AccountScreen
        user={{
          id: 'usr_seller_a_owner',
          email: 'owner@matjerhub.test',
          name: 'Seller Owner',
          roles: ['seller_owner'],
        }}
      />
    );

    expect(await screen.findByText('Profile & account')).toBeInTheDocument();
    expect(screen.getByText('Account identity')).toBeInTheDocument();
    expect(screen.getByText('Business display details')).toBeInTheDocument();
    expect(screen.getByText('Managed by MatjerHub SSO')).toBeInTheDocument();
    expect(screen.queryByText(/Unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ZITADEL/i)).not.toBeInTheDocument();
  });

  it('renders SettingsScreen with store settings', async () => {
    vi.spyOn(sellerClient, 'getStores').mockResolvedValueOnce({
      items: [{ id: 'str_a1_1001', seller_id: 'sel_a', market_code: 'SA', code: 'store-a1', name: 'Store A1', status: 'active', created_at: '', updated_at: '' }],
      active_store_limit: 5,
      active_store_count: 1,
    });
    vi.spyOn(sellerClient, 'getStoreOperationalState').mockResolvedValueOnce({
      store_id: 'str_a1_1001',
      checkout_status: 'accepting',
      maintenance_message: '',
      checkout_accepting: true,
    });

    render(<SettingsScreen storeId="str_a1_1001" />);
    expect(await screen.findByText('Store settings')).toBeInTheDocument();
    expect(screen.getByText('Identity details')).toBeInTheDocument();
    expect(screen.getByText('Checkout operations')).toBeInTheDocument();
    expect(screen.getByText('Storefront availability')).toBeInTheDocument();
    expect(screen.getByText('Save message')).toBeInTheDocument();
    expect(screen.queryByText(/Unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not supported by Core/i)).not.toBeInTheDocument();
  });

  it('renders TeamScreen with current MatjerHub SSO access context', async () => {
    vi.spyOn(sellerClient, 'getStores').mockResolvedValueOnce({
      items: [{ id: 'str_a1_1001', seller_id: 'sel_a', market_code: 'SA', code: 'store-a1', name: 'Store A1', status: 'active', created_at: '', updated_at: '' }],
      active_store_limit: 5,
      active_store_count: 1,
    });

    render(
      <SellerShellUserProvider
        user={{
          id: 'usr_seller_a_owner',
          email: 'owner@matjerhub.test',
          name: 'Seller Owner',
          roles: ['seller_owner'],
        }}
      >
        <TeamScreen storeId="str_a1_1001" />
      </SellerShellUserProvider>
    );

    expect(await screen.findByText('Team management')).toBeInTheDocument();
    expect(screen.getByText('Signed-in team member')).toBeInTheDocument();
    expect(screen.getByText('Access boundary')).toBeInTheDocument();
    expect(screen.getByText('Managed by MatjerHub SSO')).toBeInTheDocument();
    expect(screen.queryByText(/Unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ZITADEL/i)).not.toBeInTheDocument();
  });

  it('renders ShipmentsOverviewScreen with status filters', async () => {
    vi.spyOn(sellerClient, 'listStoreShipments').mockResolvedValueOnce({
      items: [],
      total_count: 0,
      page: 1,
      page_size: 50,
    });

    render(<ShipmentsOverviewScreen storeId="str_a1_1001" />);

    expect(await screen.findByText('Store Shipments Queue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ALL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PENDING' })).toBeInTheDocument();
    expect(screen.getByText('No shipments found in this status')).toBeInTheDocument();
  });

  it('renders OrderDocumentsScreen with printable markup', async () => {
    vi.spyOn(sellerClient, 'getStoreOrderDetail').mockResolvedValueOnce({
      id: 'ord_1001',
      order_number: 'ORD-1001',
      status: 'confirmed',
      currency: 'SAR',
      subtotal: 10000,
      total: 10000,
      item_count: 1,
      items: [{ id: 'item_1', product_name: 'Product A', sku_code: 'SKU-A', quantity: 1, unit_price: 10000, total_price: 10000, source: 'seller_owned' }],
      timeline: [],
      allowed_next_actions: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    render(<OrderDocumentsScreen storeId="str_a1_1001" orderId="ord_1001" />);
    expect(await screen.findByText('PACKING SLIP & RECEIPT')).toBeInTheDocument();
    expect(screen.getByText('PDF Export & ZATCA E-Invoicing Signing Unavailable')).toBeInTheDocument();
  });
});
