#!/usr/bin/env bash
# Runs the package SQL tests against a THROWAWAY local PostgreSQL cluster (never the app database).
set -euo pipefail
unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSERVICE PGSSLMODE DATABASE_URL || true
if [ "$(id -u)" = "0" ]; then   # PostgreSQL refuses to run as root: re-exec as an unprivileged account
  for u in ${MNT_PG_RUN_AS:-} postgres mntpg lovable; do
    if id "$u" >/dev/null 2>&1 && [ "$(id -u "$u")" != "0" ]; then exec setpriv --reuid="$(id -u "$u")" --regid="$(id -g "$u")" --clear-groups env HOME=/tmp PATH="$PATH" "$0"; fi
  done
  echo "PENDING: PostgreSQL cannot run as root and no unprivileged user (set MNT_PG_RUN_AS)"; exit 3
fi
HERE="$(cd "$(dirname "$0")" && pwd)"; SQL="$HERE/.."
for b in initdb pg_ctl psql; do command -v "$b" >/dev/null || { echo "PENDING: $b not available"; exit 3; }; done
TMP="$(mktemp -d /tmp/mnt-pg-XXXXXX)"; PORT=$((55000 + RANDOM % 5000))
cleanup() { pg_ctl -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
initdb -D "$TMP/data" -U postgres -A trust >/dev/null
pg_ctl -D "$TMP/data" -o "-k $TMP -p $PORT -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
P() { PGOPTIONS="${PGOPTIONS:--c client_min_messages=warning}" psql -X -q -v ON_ERROR_STOP=1 -h "$TMP" -p "$PORT" -U postgres "$@"; }
FP="SELECT md5(string_agg(x, '|' ORDER BY x)) FROM (
  SELECT 'c:'||table_name||'.'||column_name||':'||data_type||':'||is_nullable||':'||coalesce(column_default,'') x FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'mnt_%'
  UNION ALL SELECT 'k:'||conrelid::regclass||'.'||conname||':'||pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace='public'::regnamespace AND conrelid::regclass::text LIKE 'mnt_%'
  UNION ALL SELECT 'i:'||indexdef FROM pg_indexes WHERE schemaname='public' AND tablename LIKE 'mnt_%'
  UNION ALL SELECT 'p:'||tablename||'.'||policyname||':'||cmd||':'||array_to_string(roles,',')||':'||coalesce(qual,'')||':'||coalesce(with_check,'') FROM pg_policies WHERE tablename LIKE 'mnt_%'
  UNION ALL SELECT 't:'||tgrelid::regclass||'.'||tgname FROM pg_trigger WHERE NOT tgisinternal AND tgrelid::regclass::text LIKE 'mnt_%'
  UNION ALL SELECT 'f:'||p.oid::regprocedure||':'||md5(prosrc)||':'||coalesce(array_to_string(proacl,','),'') FROM pg_proc p WHERE pronamespace='public'::regnamespace AND proname LIKE 'mnt_%'
  UNION ALL SELECT 'g:'||table_name||':'||grantee||':'||privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name LIKE 'mnt_%'
  UNION ALL SELECT 'd:'||code||':'||name_i18n::text FROM public.mnt_asset_types
  UNION ALL SELECT 'd:'||code||':'||name_i18n::text FROM public.mnt_asset_families) s"

# 1. preflight: installing without host prerequisites must fail clearly and leave nothing
P -c "CREATE DATABASE nohost" >/dev/null
if P -d nohost -f "$SQL/install_v1.sql" >"$TMP/nohost.out" 2>&1; then echo "FAIL preflight sin host"; exit 1; fi
grep -q "MNT preflight failed" "$TMP/nohost.out" || { cat "$TMP/nohost.out"; echo "FAIL preflight message"; exit 1; }
[ "$(P -d nohost -Atc "SELECT count(*) FROM pg_tables WHERE tablename LIKE 'mnt_%'")" = "0" ] || { echo "FAIL preflight left tables"; exit 1; }
echo "PASS preflight: sin prerequisitos del host falla y no deja nada"

# 2. clean install + seed, then idempotent re-install/re-seed with identical fingerprint
P -c "CREATE DATABASE mnt" >/dev/null
P -d mnt -f "$HERE/fixtures/host_stub.sql" >/dev/null
P -d mnt -f "$SQL/install_v1.sql" >/dev/null
P -d mnt -f "$SQL/seed_catalog_v1.sql" >/dev/null
echo "PASS instalacion limpia desde cero + catalogo"
F1="$(P -d mnt -Atc "$FP")"
P -d mnt -f "$SQL/install_v1.sql" >/dev/null
P -d mnt -f "$SQL/seed_catalog_v1.sql" >/dev/null
F2="$(P -d mnt -Atc "$FP")"
[ "$F1" = "$F2" ] || { echo "FAIL idempotencia ($F1 != $F2)"; exit 1; }
echo "PASS idempotencia: reinstalar y resembrar deja el mismo esquema y catalogo"
[ "$(P -d mnt -Atc "SELECT count(*) FROM mnt_installation")" = "1" ] && [ "$(P -d mnt -Atc "SELECT version FROM mnt_catalog_versions")" = "1" ] \
  && echo "PASS version de instalacion y catalogo registradas una sola vez"

# Upgrade from the frozen supported revision, not a schema synthesized from current SQL.
P -c "CREATE DATABASE upgrade" >/dev/null
P -d upgrade -f "$HERE/fixtures/host_stub.sql" >/dev/null
P -d upgrade -f "$HERE/fixtures/previous/install_v1.sql" >/dev/null
P -d upgrade -c "SELECT mnt_register_org('d0000000-0000-4000-8000-000000000001'); INSERT INTO mnt_asset_families(org_id,code,name_i18n) VALUES ('d0000000-0000-4000-8000-000000000001','legacy','{\"es\":\"Legacy\"}'); INSERT INTO mnt_plans(org_id,code,name,asset_family_id,frequency) SELECT org_id,'LEGACY','Original',id,'annual' FROM mnt_asset_families WHERE code='legacy';" >/dev/null
OLD="$(P -d upgrade -Atc "SELECT md5(row(org_id,code,name,asset_family_id,frequency,status,created_at)::text) FROM mnt_plans WHERE code='LEGACY'")"
P -d upgrade -f "$SQL/install_v1.sql" >/dev/null
NEW="$(P -d upgrade -Atc "SELECT md5(row(org_id,code,name,asset_family_id,frequency,status,created_at)::text) FROM mnt_plans WHERE code='LEGACY'")"
[ "$OLD" = "$NEW" ] && [ "$(P -d upgrade -Atc "SELECT requirement_origin||'/'||plan_nature FROM mnt_plans WHERE code='LEGACY'")" = "unspecified/preventive" ] || { echo "FAIL upgrade preserves populated plan"; exit 1; }
echo "PASS upgrade de revisión congelada c15a30cf: plan poblado preservado y clasificación segura"

# 3. behaviour tests (RLS, triggers, RPC, rollback)
PGOPTIONS="-c client_min_messages=notice" P -d mnt -f "$HERE/fixtures/tests.sql" 2>&1 | sed -n 's/^.*NOTICE:  //p; /TESTS_DONE/p; /FAIL/p; /ERROR/p; /LINE/p'

# 3b. metrology add-on: preflight without install_v1, clean install, idempotence, behaviour, preventive untouched
P -c "CREATE DATABASE mtrnohost" >/dev/null
P -d mtrnohost -f "$HERE/fixtures/host_stub.sql" >/dev/null
if P -d mtrnohost -f "$SQL/install_metrology_v1.sql" >"$TMP/mtrno.out" 2>&1; then echo "FAIL mtr preflight"; exit 1; fi
grep -q "MNT metrology preflight failed" "$TMP/mtrno.out" && [ "$(P -d mtrnohost -Atc "SELECT count(*) FROM pg_tables WHERE tablename LIKE 'mnt_mtr_%'")" = "0" ] || { cat "$TMP/mtrno.out"; echo "FAIL mtr preflight msg"; exit 1; }
echo "PASS mtr preflight: sin install_v1 falla y no deja tablas"
# Clean metrology installation on an empty maintenance schema, separately from upgrade.
P -d upgrade -f "$SQL/install_metrology_v1.sql" >/dev/null
[ "$(P -d upgrade -Atc "SELECT count(*) FROM pg_tables WHERE tablename LIKE 'mnt_mtr_%'")" = "8" ] || { echo "FAIL mtr clean install"; exit 1; }
echo "PASS mtr instalación limpia sin add-on previo (8 tablas)"
PRE="$(P -d mnt -Atc "SELECT md5(coalesce(string_agg(row(p.*)::text, '|' ORDER BY p.id),'')) FROM mnt_plans p")"
# Previous add-on shape -> additive upgrade, with a real populated legacy row in the throwaway DB.
P -d mnt -f "$HERE/fixtures/previous/install_metrology_v1.sql" >/dev/null
P -d mnt -c "INSERT INTO host_stub.sites VALUES ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-0000000005a1') ON CONFLICT DO NOTHING; INSERT INTO mnt_mtr_equipment(org_id,code,name,equipment_type,site_id) VALUES ('a0000000-0000-4000-8000-000000000001','MTR-LEGACY','Original','extintor','c0000000-0000-4000-8000-0000000005a1');" >/dev/null
LEGACY="$(P -d mnt -Atc "SELECT md5(row(id,org_id,code,name,equipment_type,created_at)::text) FROM mnt_mtr_equipment WHERE code='MTR-LEGACY'")"
P -d mnt -f "$SQL/install_metrology_v1.sql" >/dev/null
[ "$LEGACY" = "$(P -d mnt -Atc "SELECT md5(row(id,org_id,code,name,equipment_type,created_at)::text) FROM mnt_mtr_equipment WHERE code='MTR-LEGACY'")" ] && [ "$(P -d mnt -Atc "SELECT parent_asset_id IS NULL FROM mnt_mtr_equipment WHERE code='MTR-LEGACY'")" = "t" ] || { echo "FAIL metrology populated upgrade"; exit 1; }
echo "PASS mtr upgrade con equipo legado: huella intacta, principal NULL"
# Remove only this disposable, activity-free fixture to keep existing isolation counts stable.
P -d mnt -c "DELETE FROM mnt_mtr_equipment WHERE code='MTR-LEGACY'" >/dev/null
M1="$(P -d mnt -Atc "$FP")"
P -d mnt -f "$SQL/install_metrology_v1.sql" >/dev/null
M2="$(P -d mnt -Atc "$FP")"
[ "$M1" = "$M2" ] || { echo "FAIL mtr idempotencia"; exit 1; }
[ "$(P -d mnt -Atc "SELECT count(*) FROM pg_tables WHERE tablename LIKE 'mnt_mtr_%'")" = "8" ] || { echo "FAIL mtr 8 tablas"; exit 1; }
echo "PASS mtr instalacion limpia (8 tablas) + reinstalacion idempotente"
PGOPTIONS="-c client_min_messages=notice" P -d mnt -f "$HERE/fixtures/metrology_tests.sql" 2>&1 | sed -n 's/^.*NOTICE:  //p; /FAIL/p; /ERROR/p; /LINE/p'
POST="$(P -d mnt -Atc "SELECT md5(coalesce(string_agg(row(p.*)::text, '|' ORDER BY p.id),'')) FROM mnt_plans p")"
[ "$PRE" = "$POST" ] || { echo "FAIL mtr altera planes preventivos"; exit 1; }
echo "PASS mtr no altera planes preventivos"

# Current optional inventory catalog; preserve legacy seed and test idempotence.
P -d mnt -f "$SQL/seed_inventory_v2.sql" >/dev/null
V1="$(P -d mnt -Atc "$FP")"
P -d mnt -f "$SQL/seed_inventory_v2.sql" >/dev/null
V2="$(P -d mnt -Atc "$FP")"
[ "$V1" = "$V2" ] || { echo "FAIL catalogo v2 idempotencia"; exit 1; }
echo "PASS catalogo v2 idempotente sin sobrescribir legado"
PGOPTIONS="-c client_min_messages=notice" P -d mnt -f "$HERE/fixtures/current_delivery.sql" 2>&1 | sed -n 's/^.*NOTICE:  //p; /FAIL/p; /ERROR/p; /LINE/p'

# Dedicated ephemeral smoke; a fresh connection proves committed persistence.
PGOPTIONS="-c client_min_messages=notice" P -d mnt -f "$HERE/fixtures/handoff_smoke.sql" 2>&1 | sed -n 's/^.*NOTICE:  //p; /FAIL/p; /ERROR/p'
PGOPTIONS="-c client_min_messages=notice" P -d mnt -f "$HERE/fixtures/smoke_readback.sql" 2>&1 | sed -n 's/^.*NOTICE:  //p; /FAIL/p; /ERROR/p'

# 4. concurrency: two simultaneous closes of the same session -> exactly one wins
S3="$(P -d mnt -At -f "$HERE/fixtures/concurrency_setup.sql" | tail -1)"
CLOSE="SET ROLE authenticated; SELECT set_config('request.jwt.claims', '{\"sub\":\"a0000000-0000-4000-8000-0000000000a1\"}', false);"
( P -d mnt -c "BEGIN; $CLOSE SELECT public.mnt_close_session('a0000000-0000-4000-8000-000000000001', '$S3'); SELECT pg_sleep(1.5); COMMIT;" >"$TMP/c1" 2>&1 && echo 0 >"$TMP/c1.rc" || echo 3 >"$TMP/c1.rc" ) &
sleep 0.4
( P -d mnt -c "$CLOSE SELECT public.mnt_close_session('a0000000-0000-4000-8000-000000000001', '$S3');" >"$TMP/c2" 2>&1 && echo 0 >"$TMP/c2.rc" || echo 3 >"$TMP/c2.rc" ) &
wait
R="$(cat "$TMP/c1.rc")$(cat "$TMP/c2.rc")"
N="$(P -d mnt -Atc "SELECT (SELECT count(*) FROM mnt_certificates WHERE session_id='$S3')||'/'||(SELECT count(*) FROM mnt_session_history WHERE session_id='$S3')")"
if { [ "$R" = "03" ] || [ "$R" = "30" ]; } && [ "$N" = "1/1" ] && grep -q "no se puede cerrar desde closed" "$TMP/c2" "$TMP/c1"; then
  echo "PASS concurrencia: dos cierres simultaneos -> uno gana, un certificado y un historial"
else echo "FAIL concurrencia rc=$R counts=$N"; cat "$TMP/c1" "$TMP/c2"; exit 1; fi
echo ALL_DONE
