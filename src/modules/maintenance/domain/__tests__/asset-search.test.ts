import { describe, expect, it } from 'vitest';
import { assetLocationContext, filterAssetCandidates, setAssetSelection } from '../asset-search';
import type { ScopeAsset, ScopeLocation } from '../scope';

const locations: ScopeLocation[] = [
  { id: 'site', name: 'Centro Málaga', code: 'MLG', parent_location_id: null },
  { id: 'room', name: 'Almacén', code: 'ALM', parent_location_id: 'site' },
];
const assets: ScopeAsset[] = [
  { id: 'a', code: 'EQ-001', name: 'Bomba', status: 'active', location_id: 'room', asset_type_id: 't1', locations: { name: 'Almacén' }, asset_types: { code: 'PRES', name_i18n: { es: 'Compresor de presión' } } },
  { id: 'b', code: 'EQ-002', name: 'Bomba', status: 'active', location_id: 'other', asset_type_id: 't2', locations: { name: 'Oficina' }, asset_types: { code: 'HVAC', name_i18n: { es: 'Climatización' } } },
];
describe('asset picker search and selection', () => {
  for (const query of ['eq-001', 'BOMBA eq-001', 'PRESION', 'compresor', 'almacen', 'CENTRO MALAGA']) {
    it(`matches ${query} without case or accent sensitivity`, () => {
      expect(filterAssetCandidates(assets, query, locations).map(a => a.id)).toEqual(['a']);
    });
  }
  it('keeps distinct same-name assets but deduplicates repeated IDs', () => {
    expect(filterAssetCandidates([...assets, assets[0]], 'bomba').map(a => a.id)).toEqual(['a', 'b']);
    expect(assetLocationContext(assets[0], locations)).toBe('Centro Málaga / Almacén');
  });
  it('combines text with existing location filtering without expanding candidates', () => {
    expect(filterAssetCandidates(assets, 'bomba', locations, 'other').map(a => a.id)).toEqual(['b']);
    expect(filterAssetCandidates([assets[0]], 'eq-002', locations)).toEqual([]);
  });
  it('preserves existing selections while selecting and deselecting another search page', () => {
    const selected = ['a'];
    expect(setAssetSelection(selected, ['b', 'b'], true)).toEqual(['a', 'b']);
    expect(setAssetSelection(['a','b'], ['b'], false)).toEqual(['a']);
    expect(selected).toEqual(['a']);
  });
  it('searching never changes inputs, selected IDs or candidate eligibility', () => {
    const before = structuredClone(assets);
    const selected = ['a'];
    expect(filterAssetCandidates(assets, 'unmatched', locations)).toEqual([]);
    expect(selected).toEqual(['a']);
    expect(assets).toEqual(before);
  });
  it('handles unknown locations and cyclic host hierarchies safely', () => {
    expect(assetLocationContext(assets[1], locations)).toBe('Oficina');
    expect(assetLocationContext(assets[0], [{ ...locations[1], parent_location_id: 'room' }])).toBe('Almacén');
  });
});