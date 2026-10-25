import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInCalendarDays } from "date-fns";
import { Search, Wrench, CalendarClock, History, ClipboardList, ChevronRight, PlayCircle, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMaintenanceRequest } from "../host";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assetKeys, assetService } from "../../services/assets";
import { sessionKeys, sessionService } from "../../services/sessions";
import { planFrequencyLabel } from "../../services/plans";
import { i18nName } from "../../domain/i18n-name";
import { AssetHistoryPanel } from "../components/asset-history-panel";
import { PlansListPage } from "./PlansListPage";
import { CreateSessionDialog } from "./SessionsListPage";

export type HubTab = "upcoming" | "history" | "plans";

const fdate = (d: string | null | undefined) => (d ? format(new Date(d), "dd/MM/yyyy") : "—");
const freqLabel = (f: string, m?: number | null) => planFrequencyLabel(f, m);

export function MaintenanceHubPage({ tab, onTabChange }: { tab: HubTab; onTabChange: (t: HubTab) => void }) {
  const { orgId, role } = useMaintenanceRequest();
  const canRun = role === "administrator" || role === "system_manager" || role === "manager";
  const canManage = role === "administrator" || role === "system_manager";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Mantenimientos</h1>
            <p className="text-sm text-muted-foreground">Previsión, histórico y planes de mantenimiento</p>
          </div>
        </div>
        {tab === "upcoming" && canRun && orgId && <CreateSessionDialog companyId={orgId} />}
      </div>
      <Tabs value={tab} onValueChange={(v) => onTabChange(v as HubTab)}>
        <TabsList>
          <TabsTrigger value="upcoming"><CalendarClock className="mr-2 h-4 w-4" />Próximos</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-2 h-4 w-4" />Histórico</TabsTrigger>
          {canManage && <TabsTrigger value="plans"><ClipboardList className="mr-2 h-4 w-4" />Planes</TabsTrigger>}
        </TabsList>
        <TabsContent value="upcoming" className="pt-4"><UpcomingTab /></TabsContent>
        <TabsContent value="history" className="pt-4"><HistoryTab /></TabsContent>
        {canManage && <TabsContent value="plans" className="pt-4"><PlansListPage embedded /></TabsContent>}
      </Tabs>
    </div>
  );
}

/** Shared asset filters (same as the Activos screen). */
function useAssetFilters() {
  const { orgId } = useMaintenanceRequest();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [family, setFamily] = useState("all");
  const [type, setType] = useState("all");
  const [site, setSite] = useState("all");
  const [grouped, setGrouped] = useState(false);
  const { data: types = [] } = useQuery({ queryKey: assetKeys.types(orgId), enabled: !!orgId, queryFn: () => assetService.listTypes(orgId) });
  const { data: families = [] } = useQuery({ queryKey: assetKeys.families(orgId), enabled: !!orgId, queryFn: () => assetService.listFamilies(orgId) });
  const { data: sites = [] } = useQuery({ queryKey: assetKeys.sites(orgId), enabled: !!orgId, queryFn: () => assetService.listActiveSites(orgId) });
  const { data: cats = [] } = useQuery({ queryKey: assetKeys.categories(orgId), enabled: !!orgId, queryFn: () => assetService.listCategories(orgId) });
  const { data: assets = [], isLoading } = useQuery({
    queryKey: assetKeys.list(orgId, "all", family, type, site, q),
    enabled: !!orgId,
    queryFn: () => assetService.listAssets(orgId, {
      typeIds: type !== "all" ? [type] : family !== "all" ? types.filter((t) => t.family_id === family).map((t) => t.id) : null,
      siteId: site !== "all" ? site : undefined, q,
    }),
  });
  const typeMap = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t])), [types]);
  const catName = useMemo(() => { const m: Record<string, string> = {}; for (const c of cats) m[c.code] = c.name; return (c: string) => m[c] ?? c; }, [cats]);
  const catCodes = useMemo(() => [...new Set([...cats.map((c) => c.code), ...types.map((t) => t.category)])].filter(Boolean), [cats, types]);
  const visibleTypes = types.filter((t) => (family === "all" || t.family_id === family) && (category === "all" || t.category === category));
  const shown = assets.filter((a) => category === "all" || (a.asset_type_id && typeMap[a.asset_type_id]?.category === category));
  const categoryOf = (a: { asset_type_id: string | null }) => (a.asset_type_id && typeMap[a.asset_type_id]?.category) || "__none";
  const catLabel = (k: string) => (k === "__none" ? "Sin categoría" : catName(k));
  const typeName = (id: string | null) => { const t = id ? typeMap[id] : null; return t ? i18nName(t.name_i18n, t.code) : "—"; };

  const activeCount = [family, category, type, site].filter((v) => v !== "all").length;
  const bar = (
    <div className="flex flex-wrap gap-3">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, nombre, nº de serie…" className="pl-9" />
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline"><SlidersHorizontal className="mr-2 h-4 w-4" />Filtros{activeCount > 0 ? ` (${activeCount})` : ""}</Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-2">
      <Select value={family} onValueChange={(v) => { setFamily(v); setType("all"); }}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las familias</SelectItem>
          {families.map((f) => <SelectItem key={f.id} value={f.id}>{i18nName(f.name_i18n, f.code)}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={category} onValueChange={(v) => { setCategory(v); setType("all"); }}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las categorías</SelectItem>
          {catCodes.map((c) => <SelectItem key={c} value={c}>{catName(c)}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={type} onValueChange={setType}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los tipos</SelectItem>
          {visibleTypes.map((t) => <SelectItem key={t.id} value={t.id}>{i18nName(t.name_i18n, t.code)}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={site} onValueChange={setSite}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las ubicaciones</SelectItem>
          {sites.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
        </SelectContent>
      </Select>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => { setFamily("all"); setCategory("all"); setType("all"); setSite("all"); }}>Quitar filtros</Button>
          )}
        </PopoverContent>
      </Popover>
      <div className="flex items-center gap-2">
        <Switch id="hub-grouped" checked={grouped} onCheckedChange={setGrouped} />
        <Label htmlFor="hub-grouped" className="text-sm">Agrupar por categoría</Label>
      </div>
    </div>
  );
  return { bar, shown, isLoading, grouped, categoryOf, catLabel, typeName };
}

function groupBy<T>(rows: T[], key: (r: T) => string, label: (k: string) => string) {
  const m = new Map<string, T[]>();
  for (const r of rows) { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); }
  return [...m.entries()].map(([k, list]) => ({ key: k, label: label(k), list }))
    .sort((a, b) => (a.key === "__none" ? 1 : b.key === "__none" ? -1 : a.label.localeCompare(b.label)));
}

function DueBadge({ date }: { date: string | null }) {
  if (!date) return <Badge variant="outline">Sin fecha</Badge>;
  const d = differenceInCalendarDays(new Date(date), new Date());
  if (d < 0) return <Badge variant="destructive">Vencido · {-d} d</Badge>;
  if (d <= 30) return <Badge variant="secondary">En {d} d</Badge>;
  return <Badge variant="outline">Al día</Badge>;
}

type SortKey = "status" | "date" | "plan" | "last";

function UpcomingTab() {
  const { orgId } = useMaintenanceRequest();
  const f = useAssetFilters();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "status", dir: 1 });
  const [viewing, setViewing] = useState<null | { title: string; assets: any[] }>(null);
  const { data: upcoming = [], isLoading } = useQuery({ queryKey: sessionKeys.upcoming(orgId), enabled: !!orgId, queryFn: () => sessionService.listUpcoming(orgId) });
  const { data: sessions = [] } = useQuery({ queryKey: sessionKeys.list(orgId, "all"), enabled: !!orgId, queryFn: () => sessionService.listSessions(orgId, "all") });
  const openSessions = sessions.filter((s) => s.status === "draft" || s.status === "in_progress");
  const assetMap = new Map(f.shown.map((a) => [a.id, a]));
  const planTotals = new Map<string, number>();
  for (const u of upcoming) planTotals.set(u.plan_id, (planTotals.get(u.plan_id) ?? 0) + 1);
  const filtered = upcoming.filter((u) => assetMap.has(u.asset_id)).map((u) => ({ ...u, asset: assetMap.get(u.asset_id)! }));

  type Row = (typeof filtered)[number];
  const buildGroups = (list: Row[]) => {
    const m = new Map<string, Row[]>();
    for (const r of list) { const k = `${r.plan_id}|${r.next_due_at ?? ""}`; if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); }
    const groups = [...m.entries()].map(([key, items]) => {
      const first = items[0];
      const last = items.map((i) => i.last_done_at).filter(Boolean).sort().pop() ?? null;
      return {
        key, plan_id: first.plan_id, plan_name: first.plan_name, frequency: first.frequency, interval_months: first.interval_months,
        execution_mode: first.execution_mode, next_due_at: first.next_due_at, last_done_at: last,
        open_session_id: items.find((i) => i.open_session_id)?.open_session_id ?? null,
        assets: items.map((i) => i.asset), total: planTotals.get(first.plan_id) ?? items.length,
      };
    });
    const due = (d: string | null) => (d ? differenceInCalendarDays(new Date(d), new Date()) : 99999);
    const status = (d: string | null) => { const x = due(d); return x < 0 ? 0 : x <= 30 ? 1 : d ? 2 : 3; };
    const cmp = (a: (typeof groups)[number], b: (typeof groups)[number]) => {
      switch (sort.key) {
        case "status": return status(a.next_due_at) - status(b.next_due_at) || due(a.next_due_at) - due(b.next_due_at);
        case "plan": return a.plan_name.localeCompare(b.plan_name);
        case "last": return (a.last_done_at ?? "").localeCompare(b.last_done_at ?? "");
        default: return (a.next_due_at ?? "9999").localeCompare(b.next_due_at ?? "9999");
      }
    };
    return groups.sort((a, b) => cmp(a, b) * sort.dir);
  };
  type Group = ReturnType<typeof buildGroups>[number];

  const renderRow = (g: Group) => (
    <TableRow key={g.key}>
      <TableCell><DueBadge date={g.next_due_at} /></TableCell>
      <TableCell className="text-sm font-medium">{fdate(g.next_due_at)}</TableCell>
      <TableCell className="text-sm">
        <Link to="/maintenance-plans/$id" params={{ id: g.plan_id }} className="font-medium hover:underline">{g.plan_name}</Link>
        <div className="text-xs text-muted-foreground">
          {freqLabel(g.frequency, g.interval_months)} · {g.execution_mode === "external" ? "Externo" : "Interno"}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{fdate(g.last_done_at)}</TableCell>
      <TableCell>
        {g.assets.length === 1 ? (
          <>
            <Link to="/assets/$id" params={{ id: g.assets[0].id }} className="font-medium hover:underline">{g.assets[0].name ?? g.assets[0].code}</Link>
            <div className="font-mono text-xs text-muted-foreground">{g.assets[0].code} · {g.assets[0].locations?.name ?? "—"}</div>
          </>
        ) : (
          <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setViewing({ title: g.plan_name, assets: g.assets })}>
            {g.assets.length < g.total ? `${g.assets.length} de ${g.total} equipos` : `${g.assets.length} equipos`} · Ver equipos
          </button>
        )}
      </TableCell>
      <TableCell>
        {g.open_session_id && (
          <Link to="/maintenance/$id" params={{ id: g.open_session_id }}>
            <Button size="sm" variant="outline"><PlayCircle className="mr-1 h-4 w-4" />Sesión abierta</Button>
          </Link>
        )}
      </TableCell>
    </TableRow>
  );
  const cols = 6;
  const SortHead = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => setSort((s) => (s.key === k ? { key: k, dir: (s.dir * -1) as 1 | -1 } : { key: k, dir: 1 }))}>
        {children}{sort.key === k && <span className="text-xs">{sort.dir === 1 ? "▲" : "▼"}</span>}
      </button>
    </TableHead>
  );
  const flatGroups = buildGroups(filtered);
  return (
    <div className="space-y-4">
      {openSessions.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Sesiones abiertas ({openSessions.length})</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {openSessions.map((s) => (
              <Link key={s.id} to="/maintenance/$id" params={{ id: s.id }}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition hover:bg-muted/50">
                <span className="font-mono text-xs text-muted-foreground">{s.code}</span>
                <span className="font-medium">{s.maintenance_plans?.name ?? "Sesión ad-hoc"}</span>
                <Badge variant={s.status === "draft" ? "outline" : "secondary"}>{s.status === "draft" ? "Borrador" : "En curso"}</Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
      {f.bar}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead k="status" className="w-[130px]">Estado</SortHead>
              <SortHead k="date">Próxima fecha</SortHead>
              <SortHead k="plan">Plan de mantenimiento</SortHead>
              <SortHead k="last">Último realizado</SortHead>
              <TableHead>Activos</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || f.isLoading ? (
              <TableRow><TableCell colSpan={cols} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
            ) : flatGroups.length === 0 ? (
              <TableRow><TableCell colSpan={cols} className="py-10 text-center text-sm text-muted-foreground">No hay mantenimientos previstos para estos filtros.</TableCell></TableRow>
            ) : f.grouped ? (
              groupBy(filtered, (r) => f.categoryOf(r.asset), f.catLabel).flatMap((c) => {
                const gs = buildGroups(c.list);
                return [
                  <TableRow key={`c-${c.key}`} className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={cols} className="py-2 text-sm font-semibold">
                      Categoría: {c.label}<span className="ml-2 font-normal text-muted-foreground">· {gs.length} previsto{gs.length === 1 ? "" : "s"}</span>
                    </TableCell>
                  </TableRow>,
                  ...gs.map((g) => renderRow({ ...g, key: `${c.key}-${g.key}` })),
                ];
              })
            ) : flatGroups.map(renderRow)}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Fechas estimadas con las reglas de cálculo actuales, pendientes de revisión.</p>
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Equipos incluidos · {viewing?.title}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Tipo</TableHead><TableHead>Ubicación</TableHead></TableRow></TableHeader>
              <TableBody>
                {viewing?.assets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.code}</TableCell>
                    <TableCell><Link to="/assets/$id" params={{ id: a.id }} className="font-medium hover:underline">{a.name ?? a.code}</Link></TableCell>
                    <TableCell className="text-sm">{f.typeName(a.asset_type_id)}</TableCell>
                    <TableCell className="text-sm">{a.locations?.name ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HistoryTab() {
  const [mode, setMode] = useState<"interventions" | "assets">("interventions");
  return (
    <div className="space-y-4">
      <ToggleGroup type="single" variant="outline" value={mode} onValueChange={(v) => v && setMode(v as typeof mode)} className="justify-start">
        <ToggleGroupItem value="interventions">Por intervenciones</ToggleGroupItem>
        <ToggleGroupItem value="assets">Por activo</ToggleGroupItem>
      </ToggleGroup>
      {mode === "interventions" ? <InterventionsHistory /> : <AssetHistory />}
    </div>
  );
}

const PAGE = 50;
const OUTCOMES: Record<string, { t: string; v: "outline" | "destructive" | "secondary" }> = {
  ok: { t: "Correcto", v: "outline" },
  with_incidents: { t: "Con incidencias", v: "destructive" },
  incomplete: { t: "Incompleto", v: "secondary" },
  incomplete_with_incidents: { t: "Incompleto con incidencias", v: "destructive" },
};
const outcomeLabel = (o: string | null) => (o ? OUTCOMES[o] ?? { t: o, v: "secondary" as const } : null);

function InterventionsHistory() {
  const { orgId } = useMaintenanceRequest();
  const [page, setPage] = useState(0);
  const { data, isLoading, isError } = useQuery({
    queryKey: sessionKeys.interventions(orgId, page * PAGE, PAGE), enabled: !!orgId,
    queryFn: () => sessionService.listInterventions(orgId, page * PAGE, PAGE),
  });
  const rows = data?.rows ?? [], total = data?.total ?? 0, pages = Math.max(1, Math.ceil(total / PAGE));
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha de ejecución</TableHead><TableHead>Plan</TableHead><TableHead>Equipos</TableHead>
              <TableHead>Resultado</TableHead><TableHead>Ejecución</TableHead><TableHead>Cierre / registro</TableHead><TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
            ) : isError ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-destructive">No se ha podido cargar el histórico.</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Aún no hay intervenciones cerradas.</TableCell></TableRow>
            ) : rows.map((r) => {
              const o = outcomeLabel(r.outcome);
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-sm font-medium">{r.executed_on ? fdate(r.executed_on) : <span className="text-muted-foreground italic">No consta</span>}</TableCell>
                  <TableCell className="text-sm">
                    {r.plan_id ? <Link to="/maintenance-plans/$id" params={{ id: r.plan_id }} className="font-medium hover:underline">{r.plan_name ?? r.plan_code}</Link> : <span className="text-muted-foreground">Sin plan</span>}
                    <div className="font-mono text-xs text-muted-foreground">{r.code}</div>
                  </TableCell>
                  <TableCell className="text-sm">{r.asset_count}</TableCell>
                  <TableCell>{o ? <Badge variant={o.v}>{o.t}</Badge> : <span className="text-sm text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm">{r.is_external ? `Externa${r.external_provider ? ` · ${r.external_provider}` : ""}` : "Interna"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fdate(r.closed_at)}</TableCell>
                  <TableCell>
                    <Link to="/maintenance/$id" params={{ id: r.id }} aria-label={`Abrir ${r.code}`}><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} intervención{total === 1 ? "" : "es"} · página {page + 1} de {pages}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
        </div>
      </div>
    </div>
  );
}

function AssetHistory() {
  const { orgId } = useMaintenanceRequest();
  const f = useAssetFilters();
  const [selected, setSelected] = useState<string | null>(null);
  const { data: upcoming = [] } = useQuery({ queryKey: sessionKeys.upcoming(orgId), enabled: !!orgId, queryFn: () => sessionService.listUpcoming(orgId) });
  const lastByAsset = new Map<string, string>();
  for (const u of upcoming) if (u.last_done_at && (!lastByAsset.has(u.asset_id) || u.last_done_at > lastByAsset.get(u.asset_id)!)) lastByAsset.set(u.asset_id, u.last_done_at);
  const sel = f.shown.find((a) => a.id === selected) ?? null;

  const renderRow = (a: (typeof f.shown)[number]) => (
    <TableRow key={a.id} className="cursor-pointer" onClick={() => setSelected(a.id)}>
      <TableCell className="font-mono text-xs">{a.code}</TableCell>
      <TableCell className="font-medium">{a.name ?? "—"}</TableCell>
      <TableCell className="text-sm">{f.typeName(a.asset_type_id)}</TableCell>
      <TableCell className="text-sm">{a.locations?.name ?? "—"}</TableCell>
      <TableCell className="text-sm">{fdate(lastByAsset.get(a.id))}</TableCell>
      <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
    </TableRow>
  );
  const cols = 6;
  return (
    <div className="space-y-4">
      {f.bar}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Tipo</TableHead>
              <TableHead>Ubicación</TableHead><TableHead>Último mantenimiento</TableHead><TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {f.isLoading ? (
              <TableRow><TableCell colSpan={cols} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
            ) : f.shown.length === 0 ? (
              <TableRow><TableCell colSpan={cols} className="py-10 text-center text-sm text-muted-foreground">No hay activos para estos filtros.</TableCell></TableRow>
            ) : f.grouped ? (
              groupBy(f.shown, f.categoryOf, f.catLabel).flatMap((g) => [
                <TableRow key={`g-${g.key}`} className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={cols} className="py-2 text-sm font-semibold">
                    Categoría: {g.label}<span className="ml-2 font-normal text-muted-foreground">· {g.list.length} equipo{g.list.length === 1 ? "" : "s"}</span>
                  </TableCell>
                </TableRow>,
                ...g.list.map(renderRow),
              ])
            ) : f.shown.map(renderRow)}
          </TableBody>
        </Table>
      </div>
      <Sheet open={!!sel} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {sel && (
            <>
              <SheetHeader>
                <SheetTitle>{sel.name ?? sel.code}</SheetTitle>
                <SheetDescription>
                  <span className="font-mono">{sel.code}</span> · {f.typeName(sel.asset_type_id)} · {sel.locations?.name ?? "Sin ubicación"}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <AssetHistoryPanel assetId={sel.id} />
                <Link to="/assets/$id" params={{ id: sel.id }}>
                  <Button variant="outline" className="w-full">Abrir ficha del activo</Button>
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
