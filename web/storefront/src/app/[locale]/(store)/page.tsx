import { loadPresentation } from '../../../server/presentation';
import { storefrontClient } from '../../../server/store-context';
import { toHomeModel, toProductCard, topLevelCategories } from '../../../lib/view-models';
import type { HomeViewModel } from '../../../themes/contract';

/**
 * The store home page.
 *
 * Composition comes from the published theme configuration: `homepage_sections` names
 * the sections and their order. The configuration carries no data selectors — no
 * category slugs, no product lists — so each section kind maps to a fixed query
 * against the public catalog. Nothing invents reviews, ratings, discounts or
 * bestseller signals, because the public contract has no such data.
 *
 * All section reads are issued together. They are independent, and running them in
 * parallel is the difference between one round trip and one per section.
 */

/** Products per home section. Small enough to stay above the fold on mobile. */
const SECTION_PRODUCT_LIMIT = 8;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const presentation = await loadPresentation(locale);
  const { context, host, settings, store } = presentation;
  const client = storefrontClient();

  const sections = await Promise.all(
    settings.homepageSections.map(async (section) => {
      if (section.kind === 'category_grid') {
        return {
          kind: section.kind,
          title: section.title,
          products: [],
          categories: topLevelCategories(presentation.categories, context.locale, 8)
        };
      }

      // There is no "featured" flag in the public contract. `featured` shows the
      // newest products and `product_carousel` the cheapest, which are the only
      // orderings the catalog read model actually offers.
      const page = await client.products(host, context.locale, {
        limit: SECTION_PRODUCT_LIMIT,
        sort: section.kind === 'featured' ? 'newest' : 'price_asc'
      });

      return {
        kind: section.kind,
        title: section.title,
        products: page.items.map((item) =>
          toProductCard(item, store.currency, context.locale, context.copy)
        ),
        categories: []
      };
    })
  );

  const model: HomeViewModel = toHomeModel({ sections, settings, locale: context.locale });
  const { Home } = presentation.theme.components;
  return <Home context={context} model={model} />;
}
