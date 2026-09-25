/** Repositories bound to the current app client. Only adapters import app infrastructure. */
import { supabase } from "@/integrations/supabase/client";
import { createAssetsRepo } from "../../data/assets.repo";
import { createChecklistsRepo } from "../../data/checklists.repo";
import { createPlansRepo } from "../../data/plans.repo";

export const assetsRepo = createAssetsRepo(supabase);
export const checklistsRepo = createChecklistsRepo(supabase);
export const plansRepo = createPlansRepo(supabase);
