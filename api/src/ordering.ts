export type OrderPuzzle = { id: string; pool: "daily" | "practice"; position: number; number: number };

export type CatalogOrder = { daily: string[]; practice: string[] };

export function deriveCatalogOrder(puzzles: OrderPuzzle[]): CatalogOrder {
  const sorted = (pool: "daily" | "practice") => puzzles.filter((p) => p.pool === pool).sort((a, b) => a.position - b.position || a.number - b.number).map((p) => p.id);
  return { daily: sorted("daily"), practice: sorted("practice") };
}

export function normalizeCatalogOrder(order: CatalogOrder, puzzles: OrderPuzzle[]): CatalogOrder {
  const byId = new Map(puzzles.map((p) => [p.id, p]));
  const result = { daily: [] as string[], practice: [] as string[] };
  for (const pool of ["daily", "practice"] as const) {
    const seen = new Set<string>();
    for (const id of order[pool]) if (!seen.has(id) && byId.get(id)?.pool === pool) { seen.add(id); result[pool].push(id); }
    for (const id of deriveCatalogOrder(puzzles)[pool]) if (!seen.has(id)) result[pool].push(id);
  }
  return result;
}

export function moveInCatalog(order: CatalogOrder, id: string, pool: "daily" | "practice", position?: number): CatalogOrder {
  const next = { daily: [...order.daily], practice: [...order.practice] };
  next.daily = next.daily.filter((item) => item !== id);
  next.practice = next.practice.filter((item) => item !== id);
  const target = next[pool];
  const index = Number.isInteger(position) ? Math.max(0, Math.min(target.length, (position as number) - 1)) : target.length;
  target.splice(index, 0, id);
  return next;
}

export function positionsForOrder(order: CatalogOrder) {
  const positions = new Map<string, number>();
  for (const pool of ["daily", "practice"] as const) order[pool].forEach((id, index) => positions.set(id, index + 1));
  return positions;
}
