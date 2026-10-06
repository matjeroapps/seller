import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { VariantOptionsModal } from '../components/seller/VariantOptionsModal';
import StoreProductDetailPage from '../app/(dashboard)/dashboard/stores/[store_id]/catalog/products/[product_id]/page';
import type { CreateProductVariantPayload } from '../lib/api/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/dashboard/stores/store_123/catalog/products/prod_456',
}));

const { mockApi } = vi.hoisted(() => {
  const mockApi = {
    getStoreProductDetail: vi.fn(),
    listStoreCategories: vi.fn(),
    listStoreMedia: vi.fn(),
    listProductMediaReferences: vi.fn(),
    updateProductTranslations: vi.fn(),
    updateProductSlug: vi.fn(),
    updateProductStatus: vi.fn(),
    archiveProduct: vi.fn(),
    createProductVariant: vi.fn(),
    updateProductVariant: vi.fn(),
    createProductSku: vi.fn(),
    updateProductSku: vi.fn(),
    attachProductMedia: vi.fn(),
    detachProductMedia: vi.fn(),
  };
  return { mockApi };
});

vi.mock('../lib/api/client', () => ({
  sellerApi: mockApi,
  sellerClient: mockApi,
}));

describe('Variant Options & SKU Physical Specs (T026-T028)', () => {
  describe('VariantOptionsModal Unit Tests', () => {
    it('does not render when isOpen is false', () => {
      const { container } = render(
        <VariantOptionsModal
          isOpen={false}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders form fields when open and closes on Cancel', () => {
      const onClose = vi.fn();
      render(
        <VariantOptionsModal
          isOpen={true}
          onClose={onClose}
          onSubmit={vi.fn()}
        />
      );

      expect(screen.getByText(/New Variant & Physical SKU Specs/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e\.g\. red-xl/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e\.g\. SKU-RED-XL/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onClose).toHaveBeenCalled();
    });

    it('supports adding attributes and submitting full payload', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <VariantOptionsModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={onSubmit}
        />
      );

      // Fill basic variant identity
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. red-xl/i), {
        target: { value: 'blue-xl' },
      });

      // Add attribute
      fireEvent.click(screen.getByRole('button', { name: /add attribute/i }));
      const attrIdInput = screen.getByPlaceholderText(/Attribute ID/i);
      const attrValInput = screen.getByPlaceholderText(/Attribute Value ID/i);

      fireEvent.change(attrIdInput, { target: { value: 'color-attr' } });
      fireEvent.change(attrValInput, { target: { value: 'blue-val' } });

      // Fill SKU & specs
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. SKU-RED-XL/i), {
        target: { value: 'SKU-BLU-XL' },
      });
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. 6281000999911/i), {
        target: { value: '6281000123456' },
      });
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. 450/i), {
        target: { value: '600' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Length \(mm\)/i), {
        target: { value: '350' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Width \(mm\)/i), {
        target: { value: '250' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Height \(mm\)/i), {
        target: { value: '80' },
      });
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. 15000/i), {
        target: { value: '18000' },
      });

      // Submit
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create variant with specs/i }));
      });

      expect(onSubmit).toHaveBeenCalledWith({
        code: 'blue-xl',
        status: 'active',
        sku_code: 'SKU-BLU-XL',
        barcode: '6281000123456',
        attribute_values: [
          { attribute_id: 'color-attr', attribute_value_id: 'blue-val' },
        ],
        weight_grams: 600,
        dimensions: {
          length_mm: 350,
          width_mm: 250,
          height_mm: 80,
        },
        price_minor_units: 18000,
      });
    });

    it('validates required SKU code when submitting specs', async () => {
      const onSubmit = vi.fn();
      render(
        <VariantOptionsModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={onSubmit}
        />
      );

      fireEvent.change(screen.getByPlaceholderText(/e\.g\. red-xl/i), {
        target: { value: 'only-code' },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create variant with specs/i }));
      });

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Product Detail Page Integration', () => {
    const sampleDetail = {
      source: 'seller_owned',
      product: {
        id: 'prod_456',
        store_id: 'store_123',
        source: 'seller_owned',
        slug: 'test-product',
        status: 'active',
        created_at: '2026-10-06T00:00:00Z',
        updated_at: '2026-10-06T00:00:00Z',
      },
      translations: [
        {
          id: 'trans_en',
          locale: 'en',
          name: 'Test Product',
          description: 'Description',
        },
      ],
      variants: [
        {
          id: 'var_1',
          code: 'var-red',
          status: 'active',
          attribute_values: [
            {
              id: 'av_1',
              attribute_id: 'attr_col',
              attribute_name: 'Color',
              attribute_code: 'color',
              value_id: 'val_red',
              value_name: 'Red',
              value_code: 'red',
            },
          ],
        },
      ],
      skus: [
        {
          id: 'sku_1',
          variant_id: 'var_1',
          code: 'SKU-RED-1',
          barcode: '628001',
          status: 'active',
          weight_grams: 500,
          length_mm: 200,
          width_mm: 150,
          height_mm: 50,
        },
      ],
      media: [],
    };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.listStoreCategories.mockResolvedValue([]);
      mockApi.getStoreProductDetail.mockResolvedValue(sampleDetail);
      mockApi.listStoreMedia.mockResolvedValue({ assets: [] });
      mockApi.listProductMediaReferences.mockResolvedValue([]);
    });

    it('renders attribute badges and physical specs in the SKU table', async () => {
      await act(async () => {
        render(
          <StoreProductDetailPage
            params={Promise.resolve({ store_id: 'store_123', product_id: 'prod_456' })}
          />
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Test Product')).toBeInTheDocument();
      });

      // Attribute badge rendered
      expect(screen.getByText(/Color: Red/i)).toBeInTheDocument();

      // Physical specs rendered in SKU table
      expect(screen.getByText('500g')).toBeInTheDocument();
      expect(screen.getByText('200×150×50mm')).toBeInTheDocument();
    });

    it('opens VariantOptionsModal when clicking Configure Variant & Specs', async () => {
      await act(async () => {
        render(
          <StoreProductDetailPage
            params={Promise.resolve({ store_id: 'store_123', product_id: 'prod_456' })}
          />
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Test Product')).toBeInTheDocument();
      });

      const openButton = screen.getByRole('button', { name: /configure variant & specs/i });
      await act(async () => {
        fireEvent.click(openButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/New Variant & Physical SKU Specs/i)).toBeInTheDocument();
      });
    });
  });
});
