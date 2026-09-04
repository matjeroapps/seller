import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { isStorefrontApiError } from '../../../../../lib/api';
import { toProductDetailModel } from '../../../../../lib/view-models';
import { loadPresentation } from '../../../../../server/presentation';
import { currentPreviewToken, storefrontClient } from '../../../../../server/store-context';
import { metadataForPage, productJsonLd, requestOrigin } from '../../../../../server/seo';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  try {
    const { locale, slug } = await params;
    const presentation = await loadPresentation(locale);
    const product = await storefrontClient().product(presentation.host, presentation.locale, slug);
    const origin = await requestOrigin(presentation.host);

    return await metadataForPage({
      host: presentation.host,
      store: presentation.store,
      locale: presentation.locale,
      page: 'product',
      slug,
      title: `${product.name} | ${presentation.store.store_name}`,
      description: product.description,
      images: (product.images || []).map((image) => image.uri),
      origin
    });
  } catch {
    return {};
  }
}

/**
 * The product detail page.
 *
 * Only public fields are rendered, and only public fields exist in the payload: name,
 * description, media, the Seller listing price, derived availability, categories and
 * selectable variants. There is no wholesale price, no supplier, no fee and no
 * fulfillment detail to leak, and the view model exposes no field that could carry
 * one.
 *
 * An unknown slug is a 404 within this store. It never falls through to another
 * store's product with the same slug, because the read is scoped by the trusted host.
 */

export default async function ProductPage({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const presentation = await loadPresentation(locale);
  const { context, host, store } = presentation;
  const previewToken = await currentPreviewToken();

  let product;
  try {
    product = await storefrontClient().product(host, context.locale, slug);
  } catch (error) {
    if (isStorefrontApiError(error) && (error.kind === 'not_found' || error.kind === 'invalid_request')) {
      notFound();
    }
    throw error;
  }

  const model = toProductDetailModel(product, store.currency, context.locale, context.copy, previewToken);
  const { ProductDetail } = presentation.theme.components;
  const origin = await requestOrigin(presentation.host);
  const jsonLd = await productJsonLd(presentation, product, origin);

  return (
    <>
      <ProductDetail context={context} model={model} />
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
    </>
  );
}
