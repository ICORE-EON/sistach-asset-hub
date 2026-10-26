import { expect, it } from 'vitest';
import { createPlansRepo } from '../plans.repo';

it('reads all eligible org-scoped candidates beyond default row caps', async () => {
  const rows = Array.from({ length: 1201 }, (_, i) => ({ id: `a-${i}`, code: `EQ-${i}` }));
  const ranges: number[][] = [];
  const filters: unknown[][] = [];
  let start = 0, end = 0;
  const chain = {
    select: () => chain, order: () => chain,
    eq: (key: string, value: unknown) => { filters.push(['eq', key, value]); return chain; },
    is: (key: string, value: unknown) => { filters.push(['is', key, value]); return chain; },
    neq: (key: string, value: unknown) => { filters.push(['neq', key, value]); return chain; },
    in: () => chain,
    range: (a: number, b: number) => { start = a; end = b; ranges.push([a,b]); return chain; },
    then: (resolve: (value: unknown) => unknown) => resolve({ data: rows.slice(start,end + 1), error: null }),
  };
  const repo = createPlansRepo({ from: () => chain } as never);
  const result = await repo.listScopeAssets('org-A', { assetTypeIds: ['type-A'], locationIds: [], includeSublocations: false });
  expect(result).toHaveLength(1201);
  expect(result.at(-1)?.id).toBe('a-1200');
  expect(ranges).toEqual([[0,499],[500,999],[1000,1499]]);
  expect(filters).toContainEqual(['eq','company_id','org-A']);
  expect(filters).toContainEqual(['is','deleted_at',null]);
  expect(filters).toContainEqual(['neq','status','retired']);
});