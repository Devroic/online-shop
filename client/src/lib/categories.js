/**
 * Categories come from the server as one flat list (in the admin's order); a
 * subcategory has `parentId`. These helpers give the one-level tree the shop and
 * the admin show.
 */

/**
 * Top-level categories in order, each with its subcategories in `children`.
 * A subcategory whose parent is not in the list (e.g. hidden) is left out.
 */
export function categoryTree(list = []) {
  const top = list.filter((c) => !c.parentId);
  return top.map((c) => ({ ...c, children: list.filter((x) => x.parentId === c.id) }));
}

/** The list in tree order: each top-level category followed by its subcategories. */
export const treeOrder = (list = []) => categoryTree(list).flatMap((c) => [c, ...c.children]);

/** "Pokémon › Singles" for a subcategory, the name alone for a top-level one. */
export function categoryPath(c, list = []) {
  if (!c) return '';
  const parent = c.parentId ? list.find((x) => x.id === c.parentId) : null;
  return parent ? `${parent.name} › ${c.name}` : c.name;
}

/** The top-level category a category belongs to (itself when it is one). */
export const topCategory = (c, list = []) => (c?.parentId ? list.find((x) => x.id === c.parentId) || c : c);
