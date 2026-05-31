import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/qr/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!token || token.length < 4 || token.length > 256) {
          return Response.json({ error: "invalid_token" }, { status: 400 });
        }

        const { data: asset, error } = await supabaseAdmin
          .from("assets")
          .select(
            "id, code, name, manufacturer, model, serial_number, status, install_date, warranty_until, company_id, location_id, asset_type_id",
          )
          .eq("qr_token", token)
          .is("deleted_at", null)
          .maybeSingle();

        if (error) return Response.json({ error: error.message }, { status: 500 });
        if (!asset) return Response.json({ error: "not_found" }, { status: 404 });

        const [{ data: company }, { data: location }, { data: type }, { data: lastSession }, { data: openIncidents }] =
          await Promise.all([
            supabaseAdmin.from("companies").select("name, logo_url, primary_color").eq("id", asset.company_id).maybeSingle(),
            asset.location_id
              ? supabaseAdmin.from("locations").select("name, code").eq("id", asset.location_id).maybeSingle()
              : Promise.resolve({ data: null }),
            supabaseAdmin.from("asset_types").select("code, name_i18n, category").eq("id", asset.asset_type_id).maybeSingle(),
            supabaseAdmin
              .from("maintenance_items")
              .select("completed_at, result, maintenance_sessions!inner(code, status, closed_at)")
              .eq("asset_id", asset.id)
              .not("completed_at", "is", null)
              .order("completed_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabaseAdmin
              .from("incidents")
              .select("id", { count: "exact", head: true })
              .eq("asset_id", asset.id)
              .in("status", ["open", "in_progress"]),
          ]);

        return Response.json({
          asset,
          company,
          location,
          asset_type: type,
          last_maintenance: lastSession,
          open_incidents_count: openIncidents ?? 0,
        });
      },
    },
  },
});
