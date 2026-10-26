import { it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

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
});