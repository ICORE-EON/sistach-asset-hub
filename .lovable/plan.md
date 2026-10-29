# Plan: QR flow for authenticated operators (MVP)

## Current situation (checked)
- The QR page at `/qr/$token` gets its data from `/api/public/qr/$token`.
- That address is public. It uses the administrator client (`supabaseAdmin`), with no session or organization check, and returns the asset, company, location, last maintenance and number of open incidents.
- Error messages vary ("invalid_token" 400 / "not_found" 404, raw database errors 500). This is a security breach and lets anyone probe whether tokens exist.
- `assets.qr_token` already exists in Sistach and in `install_v1.sql`: opaque random value, unique, contains no data. It cannot be regenerated, and nothing records who changed it.
- Sessions, items, versioned checklists, answers and incidents already exist (`SessionDetailPage`, `maintenance_items`). There is no mobile mode for scanning by session, and no closing rule that checks for pending items with a justified exception.

## Gaps
1. A public endpoint using administrator privileges, included in the app and with no export exclusion.
2. No portable contract for resolving a scanned code.
3. No mobile flow: session, scan, checklist, progress.
4. No idempotent saving per item, no closing blocked by pending items, and no exceptions with a reason.
5. No QR regeneration with traceability.

## Proposed changes
1. **Security**
   - Delete `src/routes/api/public/qr.$token.ts`.
   - Turn `/qr/$token` into a page under `_authenticated` that calls one RPC as the user: `mnt_resolve_scan(token, session_id?)`, `SECURITY INVOKER` plus RLS.
   - Missing, foreign or unauthorized token, or no permission: always the same response, `{status:'not_available'}`.
   - Add a boundary test that fails if any `/api/public/*` file imports `supabaseAdmin` on QR, or if the export includes `routes/api`.
2. **Portable contract**
   - `contracts/scan.ts`:
     - `ScanContract.resolveScan(ctx, token, {sessionId?}) → ScanResolution` (`asset` | `not_available`).
     - `recordExecution(ctx, input, idempotencyKey)`.
     - `closeSession(ctx, sessionId, exceptions[])`.
     - `regenerateQr(ctx, assetId)`.
   - `ctx` = `{orgId, personRef, can('run'|'admin')}` supplied by the host (existing ports: session, tenant, permission, person, evidence).
   - Generic resource type `kind: 'maintenance_asset'`. That is the only type for now.
3. **Mobile flow (around 390 px)**
   - New page in the module, `ui/pages/SessionRunPage.tsx`, with a thin wrapper route `/_authenticated/sessions/$id/run`.
   - It shows the list of the session's assets with Pending / Reviewed / With incident status and a progress bar.
   - "Scan" button: camera (`BarcodeDetector`, with the `@zxing/browser` library as a fallback, loaded only in the browser), plus manual code entry.
   - Scanning checks the asset's organization and that it belongs to the session, then opens the existing checklist for the item (the version recorded in the item).
   - It reuses the current item answer form. It records asset, plan, session, checklist version, `person_ref`, date and time, answers, result, notes and evidence references (existing Attachments slot).
4. **Execution and closing rules**
   - Additive RPC `mnt_record_item_execution(item_id, payload, idempotency_key)`: unique per item and key. A retry returns the same result.
   - `mnt_close_session(session_id, exceptions jsonb)`: rejects closing while applicable items are pending, unless the exception has a reason (`not_applicable` | `inaccessible` | `other` plus required text). Writes history in a new table.
   - A failed check marks the item as "With incident". The flow offers the existing "Create repair" option and emits the outbox event `mnt.session.item_anomaly`. No new action engine.
5. **QR regeneration**
   - RPC `mnt_regenerate_asset_qr(asset_id)`, for admins only. Swaps `qr_token` atomically, so the old token stops working at once, and logs to `mnt_qr_token_events` (who, when, the old token's hash, never the token itself).
   - "Regenerate QR" button with confirmation in `AssetDetailPage`.

## Minimal additive migration (Sistach + `install_v1.sql`, idempotent)
- `mnt_item_executions_idem (item_id, idempotency_key, result_ref, created_at)` UNIQUE(item_id, key).
- `mnt_session_closure_events (session_id, org_id, person_ref, closed_at, exceptions jsonb)`.
- `mnt_session_item_exceptions (item_id, reason_code, reason_text, person_ref, at)`.
- `mnt_qr_token_events (asset_id, org_id, person_ref, at, old_token_sha256)`.
- RPCs: `mnt_resolve_scan`, `mnt_record_item_execution`, `mnt_close_session`, `mnt_regenerate_asset_qr`. All `SECURITY INVOKER` except where an atomic write requires `DEFINER` with explicit checks via `mnt_can`. RLS by org on all of them.
- No changes to existing data.

## Affected files
- Delete: `src/routes/api/public/qr.$token.ts`.
- Change:
  - `src/routes/qr.$token.tsx`: move it to `_authenticated` as a thin wrapper.
  - `ui/pages/AssetDetailPage.tsx`
  - `ui/pages/SessionDetailPage.tsx`: "Run on mobile" button.
  - `contracts/index.ts`, `contracts/export-operations.ts` (+4 operations).
  - `adapters/icore/repositories.ts`: fail-closed stubs.
  - `adapters/standalone/repos/scan.repo.ts`
  - `services/scan.ts`
  - `sql/install_v1.sql`
  - `spec/*` (HOST_CONTRACTS, ICORE_ADAPTER_SPEC, INTEGRATION_HANDOFF)
  - `EXPORT_MANIFEST.json` (excludes `src/routes/api/**`)
  - `roadmap.md`
- New: `contracts/scan.ts`, `ui/pages/SessionRunPage.tsx`, a Sistach migration, SQL fixture `scan_tests.sql`, Vitest `scan.test.ts`.

## Tests
- **Temporary SQL:**
  - no session → nothing returned;
  - other organization → `not_available`, and no writes;
  - same organization without run permission → rejected;
  - asset outside the session → rejected;
  - missing token or old token after regeneration → the same generic response;
  - double submission → one execution;
  - closing with pending items → rejected;
  - closing with everything reviewed, or with a justified exception → allowed and recorded.
- **Vitest:** contract, fail-closed iCore stub, boundary (no `supabaseAdmin` and no `routes/api` in the export), existing tests unchanged.
- **Browser at 390 px:** full walkthrough with a temporary fixture deleted afterwards, or read-only if no suitable data exists (I will say which one it was).

## Acceptance criteria
- No public endpoint returns QR data.
- A copied QR does nothing without a session, the same organization and run permission.
- Closing respects pending items and exceptions.
- Regeneration invalidates the old token immediately and leaves a record.
- The export includes the contract, RPCs, page and tests, and excludes routes/api, standalone auth and demo data.
- SQL, Vitest, typecheck and build pass separately.

## Boundary with iCore
- **Done here:** portable SQL, contract, service, mobile UI, standalone adapter, tests, docs.
- **iCore completes later:**
  - real adapter for `ScanContract` over its auth, organizations, people and permissions;
  - mapping `person_ref` and `run`/`admin`;
  - evidence storage in documents/document_versions;
  - consuming `mnt.session.item_anomaly` to decide on management_actions;
  - its own authenticated `/qr/$token` route.
- Until then the iCore stub stays fail-closed.

## Note
`roadmap.md` will be updated with this task when implementation starts (plan mode does not allow editing it now).
