/**
 * ICORE adapter skeleton. Compiles against the stable contracts and implements NOTHING:
 * every operation rejects with IcoreNotConfiguredError. Real queries, table names, permissions and
 * services of ICORE must be written inside the ICORE repository (see spec/ICORE_ADAPTER_SPEC.md).
 */
import type { MaintenanceRepositories } from "../../contracts/repositories";
import type { MaintenanceAdapter } from "../../contracts/registry";

export class IcoreNotConfiguredError extends Error {
  readonly code = "MNT_ICORE_NOT_CONFIGURED";
  constructor(readonly operation: string) {
    super(`Adaptador ICORE no configurado: ${operation}`);
    this.name = "IcoreNotConfiguredError";
  }
}

const nc = (op: string) => (): Promise<never> => Promise.reject(new IcoreNotConfiguredError(op));

export function createIcoreRepositoriesSkeleton(): MaintenanceRepositories {
  return {
    assets: {
      listFamilies: nc("assets.listFamilies"),
      createFamily: nc("assets.createFamily"),
      setFamilyRequiresCertificate: nc("assets.setFamilyRequiresCertificate"),
      deleteFamily: nc("assets.deleteFamily"),
      listTypes: nc("assets.listTypes"),
      listTypesAdmin: nc("assets.listTypesAdmin"),
      createType: nc("assets.createType"),
      setTypeFamily: nc("assets.setTypeFamily"),
      deleteType: nc("assets.deleteType"),
      updateFamily: nc("assets.updateFamily"),
      updateType: nc("assets.updateType"),
      listCategories: nc("assets.listCategories"),
      saveCategory: nc("assets.saveCategory"),
      deleteCategory: nc("assets.deleteCategory"),
      listActiveSites: nc("assets.listActiveSites"),
      listScopeSites: nc("assets.listScopeSites"),
      listSites: nc("assets.listSites"),
      listAssets: nc("assets.listAssets"),
      getAsset: nc("assets.getAsset"),
      createAsset: nc("assets.createAsset"),
      updateAsset: nc("assets.updateAsset"),
      softDeleteAsset: nc("assets.softDeleteAsset"),
      listKitItems: nc("assets.listKitItems"),
      saveKitItem: nc("assets.saveKitItem"),
      insertKitItems: nc("assets.insertKitItems"),
      deleteKitItem: nc("assets.deleteKitItem"),
    },
    checklists: {
      listTemplates: nc("checklists.listTemplates"),
      getTemplate: nc("checklists.getTemplate"),
      getTemplateScope: nc("checklists.getTemplateScope"),
      createTemplate: nc("checklists.createTemplate"),
      updateTemplateScope: nc("checklists.updateTemplateScope"),
      listPublishedTemplates: nc("checklists.listPublishedTemplates"),
      listVersions: nc("checklists.listVersions"),
      latestPublishedVersions: nc("checklists.latestPublishedVersions"),
      publishVersion: nc("checklists.publishVersion"),
      createVersion: nc("checklists.createVersion"),
      listQuestions: nc("checklists.listQuestions"),
      addQuestion: nc("checklists.addQuestion"),
      deleteQuestion: nc("checklists.deleteQuestion"),
      listResponses: nc("checklists.listResponses"),
      saveResponse: nc("checklists.saveResponse"),
    },
    plans: {
      listPlans: nc("plans.listPlans"),
      getPlan: nc("plans.getPlan"),
      listPlanAssets: nc("plans.listPlanAssets"),
      listCertificateTemplates: nc("plans.listCertificateTemplates"),
      listScopeAssets: nc("plans.listScopeAssets"),
      createPlan: nc("plans.createPlan"),
      setCertificateTemplate: nc("plans.setCertificateTemplate"),
      setActive: nc("plans.setActive"),
      addAssets: nc("plans.addAssets"),
      removeAsset: nc("plans.removeAsset"),
    },
    sessions: {
      listSessions: nc("sessions.listSessions"),
      getSession: nc("sessions.getSession"),
      listItems: nc("sessions.listItems"),
      listPlansForSession: nc("sessions.listPlansForSession"),
      listPlanLocations: nc("sessions.listPlanLocations"),
      listAssetHistory: nc("sessions.listAssetHistory"),
      createSession: nc("sessions.createSession"),
      startSession: nc("sessions.startSession"),
      assertItemWritable: nc("sessions.assertItemWritable"),
      setItemResult: nc("sessions.setItemResult"),
      closeSession: nc("sessions.closeSession"),
    },
    incidents: {
      listIncidents: nc("incidents.listIncidents"),
      getIncident: nc("incidents.getIncident"),
      listHistory: nc("incidents.listHistory"),
      listMembers: nc("incidents.listMembers"),
      listAssetOptions: nc("incidents.listAssetOptions"),
      listAssetIncidents: nc("incidents.listAssetIncidents"),
      createManual: nc("incidents.createManual"),
      update: nc("incidents.update"),
      changeStatus: nc("incidents.changeStatus"),
      remove: nc("incidents.remove"),
      openForFailures: nc("incidents.openForFailures"),
    },
    certificates: {
      resolveTemplate: nc("certificates.resolveTemplate"),
      listCertificates: nc("certificates.listCertificates"),
      getCertificate: nc("certificates.getCertificate"),
      listItems: nc("certificates.listItems"),
      listIncidents: nc("certificates.listIncidents"),
      appliedTemplate: nc("certificates.appliedTemplate"),
      revoke: nc("certificates.revoke"),
      updateNotes: nc("certificates.updateNotes"),
      listAssetCertificates: nc("certificates.listAssetCertificates"),
      findSessionCertificate: nc("certificates.findSessionCertificate"),
      emitForSession: nc("certificates.emitForSession"),
      loadPdfSource: nc("certificates.loadPdfSource"),
      resolveTemplateForSession: nc("certificates.resolveTemplateForSession"),
      readFrozenLogo: nc("certificates.readFrozenLogo"),
      sha256Hex: nc("certificates.sha256Hex"),
      signedLogoUrl: nc("certificates.signedLogoUrl"),
      storePdf: nc("certificates.storePdf"),
      pdfDownloadUrl: nc("certificates.pdfDownloadUrl"),
      listTemplates: nc("certificates.listTemplates"),
      getTemplate: nc("certificates.getTemplate"),
      createTemplate: nc("certificates.createTemplate"),
      updateTemplate: nc("certificates.updateTemplate"),
      softDeleteTemplate: nc("certificates.softDeleteTemplate"),
      uploadTemplateLogo: nc("certificates.uploadTemplateLogo"),
      listAssetsForExternal: nc("certificates.listAssetsForExternal"),
      registerExternal: nc("certificates.registerExternal"),
    },
  };
}

/** Not registered anywhere in this app. ICORE replaces the skeleton with its real repositories. */
export function createIcoreAdapterSkeleton(): MaintenanceAdapter {
  return { id: "icore", repositories: createIcoreRepositoriesSkeleton() };
}
