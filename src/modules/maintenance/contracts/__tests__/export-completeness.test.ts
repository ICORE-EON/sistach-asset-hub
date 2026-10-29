import { it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';

it('exports every portable runtime dependency and keeps standalone outside', () => {
  const root = 'src/modules/maintenance';
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => {
    const p = join(dir,n); return statSync(p).isDirectory() ? walk(p) : [p];
  });
  const manifest = JSON.parse(readFileSync(`${root}/spec/EXPORT_MANIFEST.json`, 'utf8')) as { include: string[] };
  const runtime = walk(root).filter(p => /\.(ts|tsx|sql)$/.test(p) && !p.includes('/standalone/') && !p.includes('/__tests__/'));
  expect(runtime.filter(p => !manifest.include.includes(p))).toEqual([]);
  expect(manifest.include.filter(p => p.includes('/standalone/'))).toEqual([]);
  expect(manifest.include).toContain(`${root}/domain/technical-profiles.ts`);
  expect(manifest.include).toContain(`${root}/domain/maintenance-suggestions.ts`);
  expect(manifest.include).toContain(`${root}/domain/asset-search.ts`);
  expect(manifest.include).toContain(`${root}/ui/components/asset-picker.tsx`);
  const allPortable = walk(root).filter(p => !p.includes('/standalone/') && !p.includes('/adapters/__tests__/'));
  expect(allPortable.filter(p => !manifest.include.includes(p))).toEqual([]);
  expect(new Set(manifest.include).size).toBe(manifest.include.length);
  for (const file of manifest.include) {
    expect(statSync(file).isFile(), file).toBe(true);
    expect(file).not.toMatch(/(^|\/)(\.git|\.env|node_modules|dist)(\/|$)|\/standalone\//);
    if (!/\.(ts|tsx)$/.test(file)) continue;
    for (const match of readFileSync(file, 'utf8').matchAll(/(?:from\s*|import\s*\()\s*["'](\.[^"']+)["']/g)) {
      const base = normalize(join(dirname(file), match[1]));
      expect([base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].some(p => manifest.include.includes(p)), `${file} → ${match[1]}`).toBe(true);
    }
  }
});