import { getDb } from '../db.js';
import { normalizeSearch } from '../utils.js';

export function serializeCategory(c) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    image: c.image,
    sortOrder: c.sort_order,
    active: !!c.active,
    productCount: c.product_count,
  };
}

/** Loads images + variants for many products in two queries. */
function attachRelations(rows) {
  if (!rows.length) return [];
  const db = getDb();
  const ids = rows.map((r) => r.id);
  const marks = ids.map(() => '?').join(',');
  const images = db
    .prepare(`SELECT * FROM product_images WHERE product_id IN (${marks}) ORDER BY sort_order, id`)
    .all(...ids);
  const variants = db
    .prepare(`SELECT * FROM product_variants WHERE product_id IN (${marks}) ORDER BY sort_order, id`)
    .all(...ids);
  return rows.map((p) => serializeProduct(p, images.filter((i) => i.product_id === p.id), variants.filter((v) => v.product_id === p.id)));
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
    trackStock: !!p.track_stock,
    inStock: !p.track_stock || (vs.length ? vs.some((v) => v.inStock) : p.stock > 0),
    featured: !!p.featured,
    active: !!p.active,
    categoryId: p.category_id,
    category: p.category_slug ? { name: p.category_name, slug: p.category_slug } : null,
    images: images.map((i) => i.url),
    imageRecords: images.map((i) => ({ id: i.id, url: i.url })),
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
  name: 'p.name COLLATE NOCASE ASC',
  featured: 'p.featured DESC, p.created_at DESC, p.id DESC',
};

/**
 * Product listing with filtering. `admin` includes inactive products and
 * skips the out-of-stock filter.
 */
export function listProducts(
  { q, category, minPrice, maxPrice, inStock, featured, sort = 'featured', limit = 24, offset = 0, ids },
  { admin = false, hideOutOfStock = false } = {},
) {
  const where = [];
  const params = [];
  if (!admin) where.push('p.active = 1', '(c.id IS NULL OR c.active = 1)');
  if (q) {
    // Search name, description and SKU; each word must match.
    for (const word of normalizeSearch(q).trim().split(/\s+/).slice(0, 6)) {
      where.push('(norm(p.name) LIKE ? OR norm(p.description) LIKE ? OR norm(p.sku) LIKE ? OR norm(c.name) LIKE ?)');
      const like = `%${word.replace(/[%_]/g, '')}%`;
      params.push(like);
      params.push(like, like, like);
    }
  }
  if (category) {
    if (/^\d+$/.test(String(category))) {
      where.push('p.category_id = ?');
      params.push(Number(category));
    } else {
      where.push('c.slug = ?');
      params.push(category);
    }
  }
  if (minPrice != null && minPrice !== '') {
    where.push('p.price >= ?');
    params.push(Math.round(Number(minPrice)));
  }
  if (maxPrice != null && maxPrice !== '') {
    where.push('p.price <= ?');
    params.push(Math.round(Number(maxPrice)));
  }
  if (featured) where.push('p.featured = 1');
  if (ids?.length) {
    where.push(`p.id IN (${ids.map(() => '?').join(',')})`);
    params.push(...ids);
  }
  const stockExpr = `(p.track_stock = 0 OR p.stock > 0 OR EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.stock > 0))`;
  if (inStock || (hideOutOfStock && !admin)) where.push(stockExpr);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const db = getDb();
  const total = db.prepare(`SELECT COUNT(*) AS n FROM products p LEFT JOIN categories c ON c.id = p.category_id ${whereSql}`).get(...params).n;
  const rows = db
    .prepare(`${BASE} ${whereSql} ORDER BY ${SORTS[sort] || SORTS.featured} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  return { items: attachRelations(rows), total };
}

export function getProduct({ id, slug }, { admin = false } = {}) {
  const db = getDb();
  const row = id
    ? db.prepare(`${BASE} WHERE p.id = ?`).get(id)
    : db.prepare(`${BASE} WHERE p.slug = ?`).get(slug);
  if (!row || (!admin && !row.active)) return null;
  return attachRelations([row])[0];
}

export function relatedProducts(product, limit = 4) {
  const db = getDb();
  const rows = db
    .prepare(
      `${BASE} WHERE p.active = 1 AND p.id != ? AND (p.category_id IS ? OR ? IS NULL)
       ORDER BY p.featured DESC, RANDOM() LIMIT ?`,
    )
    .all(product.id, product.categoryId, product.categoryId, limit);
  return attachRelations(rows);
}
