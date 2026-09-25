import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** The only client type adapters accept; injected so tests can pass fakes. */
export type StandaloneClient = SupabaseClient<Database>;
