import { describe, it, expect } from 'vitest';
import { MAINTENANCE_SUGGESTIONS, suggestionAlreadyApplied, suggestionPlanCode } from '../maintenance-suggestions';

describe('optional maintenance suggestions', () => {
  it('never supplies an automatic frequency', () => {
    expect(MAINTENANCE_SUGGESTIONS).toHaveLength(13);
    expect(MAINTENANCE_SUGGESTIONS.every(s => s.frequency === null)).toBe(true);
  });
  it('does not infer a legal origin or reference', () => {
    expect(MAINTENANCE_SUGGESTIONS.every(s => s.origin === 'unspecified' && s.reference === null)).toBe(true);
  });
  it('prevents repeated suggestion codes and matching names', () => {
    const s = MAINTENANCE_SUGGESTIONS[0];
    expect(suggestionAlreadyApplied(s, [{ code: suggestionPlanCode(s), name: 'Renamed' }])).toBe(true);
    expect(suggestionAlreadyApplied(s, [{ code: 'CUSTOM', name: s.name }])).toBe(true);
    expect(suggestionAlreadyApplied(s, [{ code: 'OTHER', name: 'Other' }])).toBe(false);
  });
  it('instrument task is calibration, not corrective', () => {
    expect(MAINTENANCE_SUGGESTIONS.find(s => s.id === 'MED')?.nature).toBe('calibration');
  });
});