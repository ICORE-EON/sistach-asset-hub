/** Corrective (2B) use-cases and org-scoped query keys. */
import { getRepositories } from "../contracts/registry";
import type { CorrectiveClose, NewCorrective } from "../contracts/corrective";
import { validateCorrectiveClose, validateNewCorrective } from "../domain/corrective-rules";

const repo = () => {
  const r = getRepositories().corrective;
  if (!r) throw new Error("Mantenimiento: el adaptador registrado no ofrece reparaciones");
  return r;
};
const need = (orgId: string | null | undefined): string => {
  if (!orgId) throw new Error("Sin empresa activa");
  return orgId;
};
const fail = (errs: string[]) => { if (errs.length) throw new Error(errs.join(". ")); };

export const correctiveKeys = {
  all: (orgId: string | null) => ["corrective", orgId] as const,
  list: (orgId: string | null, open: boolean, assetId?: string) => ["corrective", orgId, "list", open, assetId ?? null] as const,
  detail: (orgId: string | null, id: string) => ["corrective", orgId, "detail", id] as const,
  entries: (orgId: string | null, id: string) => ["corrective", orgId, "entries", id] as const,
};

export const correctiveService = {
  available: () => !!getRepositories().corrective,
  list: (orgId: string | null, filter: { open?: boolean; assetId?: string }) => repo().list(need(orgId), filter),
  get: (orgId: string | null, id: string) => repo().get(need(orgId), id),
  listEntries: (orgId: string | null, id: string) => repo().listEntries(need(orgId), id),
  create: (orgId: string | null, v: NewCorrective, today: string) => {
    fail(validateNewCorrective(v, today));
    return repo().create(need(orgId), v);
  },
  addEntry: (orgId: string | null, id: string, performedOn: string, text: string) => {
    if (!text.trim()) throw new Error("Describe la actuación");
    return repo().addEntry(need(orgId), id, performedOn, text.trim());
  },
  linkIncident: (orgId: string | null, id: string, incidentId: string | null) => repo().linkIncident(need(orgId), id, incidentId),
  close: (orgId: string | null, id: string, v: CorrectiveClose, detectedOn: string, today: string) => {
    fail(validateCorrectiveClose(v, detectedOn, today));
    return repo().close(need(orgId), id, v);
  },
};
