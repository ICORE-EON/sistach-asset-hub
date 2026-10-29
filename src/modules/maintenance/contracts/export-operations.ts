/** Complete export surface, including optional capabilities. No host implementation is implied. */
import { OPERATIONS, type OperationSpec } from './operations';
import type { CorrectiveRepository } from './corrective';
import type { MetrologyContract } from './metrology';

const read = (authority: string, host: OperationSpec['host'] = []): OperationSpec => ({ kind: 'read', perm: 'mnt.view', authority, host, orgScoped: true });
const write = (authority: string, perm = 'mnt.manage_assets'): OperationSpec => ({ kind: 'write', perm, authority, host: [], orgScoped: true });
const atomic = (authority: string, perm = 'mnt.close'): OperationSpec => ({ kind: 'atomic', perm, authority, host: [], orgScoped: true });

export const CORRECTIVE_OPERATIONS = {
  'corrective.list': read('RLS mnt_sessions (kind=corrective)'),
  'corrective.get': read('RLS mnt_sessions (kind=corrective)'),
  'corrective.listEntries': read('RLS mnt_intervention_entries'),
  'corrective.create': atomic('RPC mnt_create_corrective', 'mnt.run'),
  'corrective.update': atomic('RPC mnt_update_corrective', 'mnt.run'),
  'corrective.addEntry': atomic('RPC mnt_add_entry', 'mnt.run'),
  'corrective.linkIncident': atomic('RPC mnt_link_incident', 'mnt.run'),
  'corrective.close': atomic('RPC mnt_close_corrective'),
} satisfies Record<`corrective.${keyof CorrectiveRepository}`, OperationSpec>;

export const METROLOGY_OPERATIONS = {
  'metrology.listSites': read('SitePort.tree', ['sites']),
  'metrology.listPeople': read('PeoplePort.search', ['people']),
  'metrology.listEquipment': read('RLS mnt_mtr_equipment'),
  'metrology.getEquipment': read('RLS mnt_mtr_equipment'),
  'metrology.createEquipment': write('RLS + mnt_mtr_tg_equipment_guard; code supplied by host'),
  'metrology.updateEquipment': write('RLS + mnt_mtr_tg_equipment_guard + mnt_mtr_tg_asset_link_guard'),
  'metrology.listPlans': read('RLS mnt_mtr_control_plans'),
  'metrology.savePlan': write('RLS mnt_mtr_control_plans'),
  'metrology.listRecords': read('RLS mnt_mtr_records'),
  'metrology.getRecordLines': read('RLS mnt_mtr_record_lines'),
  'metrology.saveDraft': atomic('Transacción de borrador y líneas bajo RLS/guardas', 'mnt.run'),
  'metrology.validateRecord': atomic('RPC mnt_mtr_validate_record'),
  'metrology.rectifyRecord': atomic('RPC mnt_mtr_rectify_record'),
  'metrology.decideUnfit': atomic('RPC mnt_mtr_decide_unfit'),
  'metrology.listImpactReviews': read('RLS mnt_mtr_impact_reviews'),
  'metrology.closeImpact': atomic('RPC mnt_mtr_close_impact'),
  'metrology.moveSite': atomic('RPC mnt_mtr_move_site', 'mnt.manage_assets'),
  'metrology.setStatus': atomic('RPC mnt_mtr_set_status', 'mnt.manage_assets'),
  'metrology.listHistory': read('RLS mnt_mtr_status_history / site_moves / unfit_decisions'),
  'metrology.findByAsset': read('RLS mnt_mtr_equipment.asset_id'),
  'metrology.listLinkableAssets': read('RLS mnt_assets; identity eligibility'),
  'metrology.linkAsset': write('RLS + mnt_mtr_tg_asset_link_guard (set-once, unique)'),
  'metrology.getInventoryAsset': read('RLS mnt_assets + sites/types', ['sites']),
  'metrology.associateEquipment': atomic('RPC mnt_mtr_associate_equipment', 'mnt.manage_assets'),
} satisfies Record<`metrology.${keyof MetrologyContract}`, OperationSpec>;

export const EXPORT_OPERATIONS = { ...OPERATIONS, ...CORRECTIVE_OPERATIONS, ...METROLOGY_OPERATIONS };