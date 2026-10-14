import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import StoreProductDetailPage from '../app/(dashboard)/dashboard/stores/[store_id]/catalog/products/[product_id]/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard/stores/store_123/catalog/products/prod_456',
}));

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    getStoreProductDetail: vi.fn(),
    listStoreCategories: vi.fn(),
    listProductMediaReferences: vi.fn(),
    updateStoreProduct: vi.fn(),
    updateListingPrice: vi.fn(),
    updateProductStatus: vi.fn(),
    createProductVariant: vi.fn(),
    getAuthoringLimits: vi.fn(),
    createAuthoringJob: vi.fn(),
  },
}));
vi.mock('../lib/api/client', () => ({ sellerApi: mockApi, sellerClient: mockApi }));

const detail = {
  product: { id: 'prod_456', store_id: 'store_123', source: 'seller_owned', slug: 'leather-wallet', status: 'draft', created_at: '2026-10-06T00:00:00Z', updated_at: '2026-10-06T00:00:00Z' },
  translations: [
    { locale: 'en', name: 'Classic Leather Wallet', description: 'Premium wallet.' },
    { locale: 'ar', name: 'محفظة جلدية كلاسيكية', description: 'محفظة فاخرة.' },
  ],
  variants: [{ id: 'var_1', code: 'COLOR-BROWN', status: 'active', attribute_values: [{ id: 'av_1', attribute_id: 'color', attribute_name: 'Color', attribute_code: 'color', value_id: 'brown', value_name: 'Brown', value_code: 'brown' }] }],
  skus: [],
  inventory: [],
  store_category_ids: [],
  current_price: { currency: 'EGP', amount_minor: 20000 },
  listing: { id: 'listing_1' },
};

async function renderDetail() {
  let utils: ReturnType<typeof render>;
  await act(async () => {
    utils = render(<StoreProductDetailPage params={Promise.resolve({ store_id: 'store_123', product_id: 'prod_456' })} />);
  });
  return utils!;
}

describe('shared product editor detail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getStoreProductDetail.mockResolvedValue(detail);
    mockApi.listStoreCategories.mockResolvedValue([]);
    mockApi.listProductMediaReferences.mockResolvedValue({ items: [{ id: 'ref_1', product_id: 'prod_456', asset_id: 'asset_1', url: 'https://cdn.example/wallet.png', alt_text: 'Wallet', is_primary: true }] });
    mockApi.updateStoreProduct.mockResolvedValue(detail);
    mockApi.updateListingPrice.mockResolvedValue({ status: 'ok' });
    mockApi.updateProductStatus.mockResolvedValue({ status: 'ok' });
    mockApi.getAuthoringLimits.mockResolvedValue({ effective_limit: 3, default_count: 1 });
    mockApi.createAuthoringJob.mockResolvedValue({ id: 'job_1', status: 'processing', text_status: 'processing', image_status: 'processing', requested_image_count: 1, fields: [], images: [] });
  });

  it('loads the same editable fields and selected media used by the add page', async () => {
    await renderDetail();
    await waitFor(() => expect(screen.getByDisplayValue('Classic Leather Wallet')).toBeInTheDocument());
    expect(screen.getByDisplayValue('محفظة جلدية كلاسيكية')).toBeInTheDocument();
    expect(screen.getByDisplayValue('leather-wallet')).toBeInTheDocument();
    expect(screen.getByText('وسائط وصور المنتج')).toBeInTheDocument();
  });

  it('persists edits and always releases the save busy state after success', async () => {
    await renderDetail();
    await waitFor(() => expect(screen.getByDisplayValue('Classic Leather Wallet')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('product-name-en'), { target: { value: 'Updated Wallet' } });
    const save = screen.getByRole('button', { name: 'حفظ التعديلات' });
    fireEvent.click(save);
    await waitFor(() => expect(mockApi.updateStoreProduct).toHaveBeenCalledWith('store_123', 'prod_456', expect.objectContaining({ slug: 'leather-wallet' })));
    await waitFor(() => expect(screen.getByRole('button', { name: 'حفظ التعديلات' })).toBeEnabled());
    expect(screen.getByRole('status')).toHaveTextContent('تم حفظ تعديلات المنتج بنجاح');
  });

  it('wires both AI entry points to the authoring generator', async () => {
    await renderDetail();
    await waitFor(() => expect(screen.getByDisplayValue('Classic Leather Wallet')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('اقتراح صياغة ذكية'));
    fireEvent.click(screen.getByRole('button', { name: /توليد وصف تسويقي/ }));
    await waitFor(() => expect(mockApi.createAuthoringJob).toHaveBeenCalled());
  });

  it('opens the options and variants dialog from the shared editor', async () => {
    await renderDetail();
    await waitFor(() => expect(screen.getByDisplayValue('Classic Leather Wallet')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'إدارة الخيارات والمتغيرات' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
