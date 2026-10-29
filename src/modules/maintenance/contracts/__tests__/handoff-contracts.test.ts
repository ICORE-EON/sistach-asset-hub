import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { EXPORT_OPERATIONS } from '../export-operations';
import { createIcoreRepositoriesSkeleton, IcoreNotConfiguredError } from '../../adapters/icore/repositories';

const root = 'src/modules/maintenance';
const declared = () => {
  const keys: string[] = [];
  for (const [file, prefix] of [['repositories.ts', null], ['corrective.ts', 'corrective'], ['metrology.ts', 'metrology']] as const) {
    let block: string | null = null;
    for (const line of readFileSync(`${root}/contracts/${file}`, 'utf8').split('\n')) {
      const match = /^export interface (\w+)(Repository|Contract) \{/.exec(line);
      if (match) block = prefix ?? match[1].toLowerCase();
      if (line.startsWith('}')) block = null;
      const op = /^  (\w+)\(/.exec(line);
      if (block && block !== 'maintenance' && op) keys.push(`${block}.${op[1]}`);
    }
  }
  return keys.sort();
};

describe('sealed handoff contracts', () => {
  it('manifest declares exactly every core, corrective and metrology operation', () => {
    const manifest = JSON.parse(readFileSync(`${root}/spec/EXPORT_MANIFEST.json`, 'utf8'));
    const keys = Object.keys(EXPORT_OPERATIONS).sort();
    expect(keys).toEqual(declared());
    expect(manifest.operationKeys).toEqual(keys);
    expect(manifest.operations).toBe(keys.length);
    expect(keys).toContain('metrology.associateEquipment');
    expect(keys).toContain('metrology.linkAsset');
    expect(manifest.capabilities.metrology).toBe(false);
  });
  it.each(Object.keys(EXPORT_OPERATIONS))('%s has an explicit fail-closed contract, not a simulated implementation', async key => {
    const repos = createIcoreRepositoriesSkeleton() as unknown as Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;
    const [capability, name] = key.split('.');
    const operation = repos[capability]?.[name];
    expect(typeof operation).toBe('function');
    if (!operation) throw new Error(`Missing operation ${key}`);
    await expect(operation('org-a')).rejects.toMatchObject({ code: 'MNT_ICORE_NOT_CONFIGURED', operation: key });
    await expect(operation('org-b')).rejects.toBeInstanceOf(IcoreNotConfiguredError);
  });
  it('every named atomic RPC exists in the exported SQL', () => {
    const sql = ['install_v1.sql', 'install_metrology_v1.sql'].map(file => readFileSync(`${root}/sql/${file}`, 'utf8')).join('\n');
    for (const [key, spec] of Object.entries(EXPORT_OPERATIONS)) {
      for (const match of spec.authority.matchAll(/RPC (mnt_\w+)/g)) expect(sql, key).toContain(`public.${match[1]}(`);
    }
  });
});