import { describe, it, expect } from 'vitest';
import { MAINTENANCE_SUGGESTIONS, MAINTENANCE_SUGGESTIONS_VERSION, suggestionAlreadyApplied, suggestionPlanCode } from '../maintenance-suggestions';

describe('optional maintenance suggestions', () => {
  it('ships a versioned catalog with unique intervention codes', () => {
    expect(MAINTENANCE_SUGGESTIONS_VERSION).toBe(2);
    expect(MAINTENANCE_SUGGESTIONS).toHaveLength(37);
    expect(new Set(MAINTENANCE_SUGGESTIONS.map(suggestionPlanCode)).size).toBe(37);
  });
  for (const id of ['EXT', 'BIE', 'DET']) {
    it(`proposes a reviewable quarterly frequency for ${id}`, () => {
      expect(MAINTENANCE_SUGGESTIONS.find(s => s.id === id)?.frequency).toBe('quarterly');
    });
  }
  for (const id of ['EXT-ANUAL', 'BIE-ANUAL', 'DET-ANUAL']) {
    it(`proposes a reviewable annual frequency for ${id}`, () => {
      expect(MAINTENANCE_SUGGESTIONS.find(s => s.id === id)?.frequency).toBe('annual');
    });
  }
  it('leaves every other intervention frequency company-defined, including preuse and regulated inspections', () => {
    const timed = new Set(['EXT','BIE','DET','EXT-ANUAL','BIE-ANUAL','DET-ANUAL']);
    const other = MAINTENANCE_SUGGESTIONS.filter(s => !timed.has(s.id));
    expect(other).toHaveLength(31);
    expect(other.every(s => s.frequency === null)).toBe(true);
  });
  it('never infers a legal origin or accredited reference', () => {
    expect(MAINTENANCE_SUGGESTIONS.every(s => s.origin === 'unspecified' && s.reference === null)).toBe(true);
  });
  for (const id of ['EXT','BIE','DET','CLI','BT','TIERRA','FV','SAI','VEH','CAR','COMP','ELEV','MED']) {
    it(`preserves legacy identity ${id} and duplicate protection after renaming`, () => {
      const s = MAINTENANCE_SUGGESTIONS.find(s => s.id === id);
      expect(s).toBeDefined();
      if (!s) throw new Error(`Missing ${id}`);
      expect(suggestionPlanCode(s)).toBe(`SUG-${id}`);
      const plans = [{ code: `sug-${id.toLowerCase()}`, name: 'Existing renamed plan' }];
      const before = structuredClone(plans);
      expect(suggestionAlreadyApplied(s, plans)).toBe(true);
      expect(plans).toEqual(before);
    });
  }
  it('blocks matching names but permits different interventions on the same type', () => {
    const s = MAINTENANCE_SUGGESTIONS[0];
    expect(suggestionAlreadyApplied(s, [{ code: 'CUSTOM', name: ` ${s.name.toUpperCase()} ` }])).toBe(true);
    expect(suggestionAlreadyApplied(s, [{ code: 'SUG-EXT-ANUAL', name: 'Other' }])).toBe(false);
  });
  it('separates calibration from internal verification and visual checks without corrective plans', () => {
    expect(MAINTENANCE_SUGGESTIONS.find(s => s.id === 'MED')?.nature).toBe('calibration');
    expect(MAINTENANCE_SUGGESTIONS.find(s => s.id === 'MED-VERIFICACION')?.nature).toBe('calibration');
    expect(MAINTENANCE_SUGGESTIONS.find(s => s.id === 'MED')?.typeCodes).not.toContain('FLEXOMETRO');
    expect(MAINTENANCE_SUGGESTIONS.find(s => s.id === 'MED-VISUAL')?.typeCodes).toContain('FLEXOMETRO');
    expect(MAINTENANCE_SUGGESTIONS.every(s => ['preventive','calibration'].includes(s.nature))).toBe(true);
  });
});
