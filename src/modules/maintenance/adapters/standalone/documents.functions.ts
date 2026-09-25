import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  orgId: z.string().uuid(),
  kind: z.string().min(1).max(64),
  subject: z.object({ type: z.enum(["asset", "incident", "maintenance_session", "certificate"]), id: z.string().uuid() }),
  bytesRef: z.string().min(1).max(1024),
  mime: z.string().min(1).max(255),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const SUBJECT_COLUMN = {
  asset: "asset_id",
  incident: "incident_id",
  maintenance_session: "maintenance_session_id",
  certificate: "certificate_id",
} as const;

/**
 * Registers a document version from an already uploaded object in the `documents` bucket.
 * Runs as the calling user (RLS applies); the SHA-256 is computed here, never trusted from the client.
 * Standalone has no versioning: versionId === documentId.
 */
export const registerDocumentVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    if (!data.bytesRef.startsWith(`${data.orgId}/`)) throw new Error("Ruta fuera de la organización");
    const { data: blob, error: dlErr } = await context.supabase.storage.from("documents").download(data.bytesRef);
    if (dlErr || !blob) throw new Error("Objeto no encontrado");
    const buf = await blob.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const title = typeof data.meta?.title === "string" ? data.meta.title : data.bytesRef.split("/").pop()!;
    const { data: row, error } = await context.supabase
      .from("documents")
      .insert({
        company_id: data.orgId, category: data.kind, title,
        storage_bucket: "documents", storage_path: data.bytesRef,
        mime_type: data.mime, file_size_bytes: buf.byteLength, file_hash_sha256: sha256,
        uploaded_by: context.userId,
        [SUBJECT_COLUMN[data.subject.type]]: data.subject.id,
      } as never)
      .select("id").single();
    if (error) throw new Error(error.message);
    return { documentId: row.id, versionId: row.id, sha256 };
  });
