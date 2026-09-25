/** Repositories bound to the current app client. Only adapters import app infrastructure. */
import { supabase } from "@/integrations/supabase/client";
import { createAssetsRepo } from "../../data/assets.repo";
import { createChecklistsRepo } from "../../data/checklists.repo";

export const assetsRepo = createAssetsRepo(supabase);
export const checklistsRepo = createChecklistsRepo(supabase);
