/** Repositories bound to the current app client. Only adapters import app infrastructure. */
import { supabase } from "@/integrations/supabase/client";
import { buildCertificatePdf } from "@/lib/certificate-pdf";
import { createAssetsRepo } from "../../data/assets.repo";
import { createChecklistsRepo } from "../../data/checklists.repo";
import { createPlansRepo } from "../../data/plans.repo";
import { createSessionsRepo } from "../../data/sessions.repo";
import { createIncidentsRepo } from "../../data/incidents.repo";
import { createCertificatesRepo } from "../../data/certificates.repo";

export const assetsRepo = createAssetsRepo(supabase);
export const checklistsRepo = createChecklistsRepo(supabase);
export const plansRepo = createPlansRepo(supabase);
export const sessionsRepo = createSessionsRepo(supabase);
export const incidentsRepo = createIncidentsRepo(supabase);
export const certificatesRepo = createCertificatesRepo(supabase);
/** PDF renderer (pdf-lib, runs in the browser as before). */
export const renderCertificatePdf = buildCertificatePdf;
