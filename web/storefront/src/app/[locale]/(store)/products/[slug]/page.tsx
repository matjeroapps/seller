import { notFound } from 'next/navigation';

import { isStorefrontApiError } from '../../../../../lib/api';
import { toProductDetailModel } from '../../../../../lib/view-models';
import { loadPresentation } from '../../../../../server/presentation';
import { storefrontClient } from '../../../../../server/store-context';

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

  let product;
  try {
    product = await storefrontClient().product(host, context.locale, slug);
  } catch (error) {
    if (isStorefrontApiError(error) && (error.kind === 'not_found' || error.kind === 'invalid_request')) {
      notFound();
    }
    throw error;
  }

  const model = toProductDetailModel(product, store.currency, context.locale, context.copy);
  const { ProductDetail } = presentation.theme.components;
  return <ProductDetail context={context} model={model} />;
}
