import { db } from '../db.js';
import { normalizeSearch, params } from '../utils.js';

export function serializeCategory(c) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    image: c.image,
    sortOrder: c.sort_order,
    active: c.active,
    productCount: c.product_count,
  };
}

/** Loads images + variants for many products in two queries. */
async function attachRelations(rows, conn = db()) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const images = await conn.all('SELECT * FROM product_images WHERE product_id = ANY($1) ORDER BY sort_order, id', [ids]);
  const variants = await conn.all('SELECT * FROM product_variants WHERE product_id = ANY($1) ORDER BY sort_order, id', [ids]);
  return rows.map((p) =>
    serializeProduct(
      p,
      images.filter((i) => i.product_id === p.id),
      variants.filter((v) => v.product_id === p.id),
    ),
  );
}

function serializeProduct(p, images, variants) {
  const vs = variants.map((v) => ({
    id: v.id,
    name: v.name,
    sku: v.sku,
    price: v.price ?? p.price,
    priceOverride: v.price,
    stock: v.stock,
    inStock: !p.track_stock || v.stock > 0,
  }));
  const stock = vs.length ? vs.reduce((n, v) => n + v.stock, 0) : p.stock;
  const prices = vs.length ? vs.map((v) => v.price) : [p.price];
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: p.price,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    compareAtPrice: p.compare_at_price,
    sku: p.sku,
    stock,
    trackStock: p.track_stock,
    inStock: !p.track_stock || (vs.length ? vs.some((v) => v.inStock) : p.stock > 0),
    featured: p.featured,
    active: p.active,
    categoryId: p.category_id,
    category: p.category_slug ? { name: p.category_name, slug: p.category_slug } : null,
    images: images.map((i) => i.url),
    variants: vs,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

const BASE = `SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p
  LEFT JOIN categories c ON c.id = p.category_id`;

const SORTS = {
  newest: 'p.created_at DESC, p.id DESC',
  price_asc: 'p.price ASC, p.id',
  price_desc: 'p.price DESC, p.id',
  name: 'lower(p.name) ASC',
  featured: 'p.featured DESC, p.created_at DESC, p.id DESC',
};

/**
 * Product listing with filtering. `admin` includes inactive products and
 * skips the out-of-stock filter.
 */
export async function listProducts(
  { q, category, minPrice, maxPrice, inStock, featured, sort = 'featured', limit = 24, offset = 0, ids },
  { admin = false, hideOutOfStock = false } = {},
) {
  const where = [];
  const { list, p } = params();
  if (!admin) where.push('p.active', '(c.id IS NULL OR c.active)');
  if (q) {
    // Accent/case-insensitive: search_text is stored normalised. Each word must match.
    for (const word of normalizeSearch(q).trim().split(/\s+/).slice(0, 6)) {
      const like = p(`%${word.replace(/[%_\\]/g, '')}%`);
      where.push(`(p.search_text LIKE ${like} OR c.search_name LIKE ${like})`);
    }
  }
  if (category) {
    if (/^\d+$/.test(String(category))) where.push(`p.category_id = ${p(Number(category))}`);
    else where.push(`c.slug = ${p(category)}`);
  }
  if (minPrice != null && minPrice !== '') where.push(`p.price >= ${p(Math.round(Number(minPrice)))}`);
  if (maxPrice != null && maxPrice !== '') where.push(`p.price <= ${p(Math.round(Number(maxPrice)))}`);
  if (featured) where.push('p.featured');
  if (ids?.length) where.push(`p.id = ANY(${p(ids)})`);
  if (inStock || (hideOutOfStock && !admin)) {
    where.push('(NOT p.track_stock OR p.stock > 0 OR EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.stock > 0))');
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { n: total } = await db().one(
    `SELECT COUNT(*)::int AS n FROM products p LEFT JOIN categories c ON c.id = p.category_id ${whereSql}`,
    list,
  );
  const rows = await db().all(
    `${BASE} ${whereSql} ORDER BY ${SORTS[sort] || SORTS.featured} LIMIT ${p(limit)} OFFSET ${p(offset)}`,
    list,
  );
  return { items: await attachRelations(rows), total };
}

export async function getProduct({ id, slug }, { admin = false, conn = db() } = {}) {
  const row = id ? await conn.one(`${BASE} WHERE p.id = $1`, [id]) : await conn.one(`${BASE} WHERE p.slug = $1`, [slug]);
  if (!row || (!admin && !row.active)) return null;
  return (await attachRelations([row], conn))[0];
}

export async function relatedProducts(product, limit = 4) {
  const rows = await db().all(
    `${BASE} WHERE p.active AND p.id != $1 AND (p.category_id = $2 OR $2::int IS NULL)
     ORDER BY p.featured DESC, random() LIMIT $3`,
    [product.id, product.categoryId, limit],
  );
  return attachRelations(rows);
}

/** Text used by search: name, description, SKU — lowercase, no accents. */
export const productSearchText = ({ name, description, sku, variants = [] }) =>
  normalizeSearch([name, description, sku, ...variants.map((v) => `${v.name} ${v.sku || ''}`)].join(' '));
