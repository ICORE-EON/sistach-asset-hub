import { useMemo, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { assetTypeName, type ScopeAsset, type ScopeLocation } from '../../domain/scope';
import { assetLocationContext, filterAssetCandidates, setAssetSelection } from '../../domain/asset-search';

const PAGE_SIZE = 40;

/** Controlled multi-selection: caller owns scope, permissions, eligibility and persistence. */
export function AssetPicker({ candidates, selected, onChange, locations = [], loading = false }: {
  candidates: ScopeAsset[]; selected: string[]; onChange: (ids: string[]) => void;
  locations?: ScopeLocation[]; loading?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('__all__');
  const [page, setPage] = useState(0);
  const matches = useMemo(() => filterAssetCandidates(candidates, search, locations, location === '__all__' ? undefined : location), [candidates, search, locations, location]);
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = matches.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const picked = filterAssetCandidates(candidates, '', locations).filter(a => selected.includes(a.id));
  const options = [...new Map(candidates.filter(a => a.location_id).map(a => [a.location_id, assetLocationContext(a, locations)])).entries()];
  const allChecked = visible.length > 0 && visible.every(a => selected.includes(a.id));
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      <div className="relative min-w-0 flex-1 basis-52">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input aria-label="Buscar activos" placeholder="Código, nombre, tipo o centro…" className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      </div>
      <Select value={location} onValueChange={v => { setLocation(v); setPage(0); }}>
        <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar ubicación de activos"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="__all__">Todas las ubicaciones</SelectItem>{options.map(([id, name]) => id && <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <label className="flex items-center gap-2"><Checkbox disabled={!visible.length || loading} checked={allChecked} onCheckedChange={v => onChange(setAssetSelection(selected, visible.map(a => a.id), v === true))} />Seleccionar esta página ({visible.length})</label>
      <span role="status" className="text-xs text-muted-foreground">{loading ? 'Cargando equipos…' : `${matches.length} resultados · ${selected.length} seleccionados`}</span>
    </div>
    <div className="max-h-72 overflow-y-auto rounded-md border">
      {!visible.length ? <p className="p-4 text-center text-sm text-muted-foreground">{loading ? 'Cargando…' : 'No hay equipos que coincidan.'}</p> : visible.map(a => <label key={a.id} className="flex cursor-pointer items-start gap-3 border-b p-3 last:border-0 hover:bg-muted/50">
        <Checkbox className="mt-1 shrink-0" checked={selected.includes(a.id)} onCheckedChange={v => onChange(setAssetSelection(selected, [a.id], v === true))} aria-label={`Seleccionar ${a.code}`} />
        <span className="min-w-0 flex-1 text-sm">
          <span className="block break-words"><span className="font-mono text-xs">{a.code}</span> · {a.name ?? '(sin nombre)'}</span>
          <span className="block break-words text-xs text-muted-foreground">{assetTypeName(a)} · {assetLocationContext(a, locations)}</span>
        </span>
      </label>)}
    </div>
    {pageCount > 1 && <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
      <Button size="icon" variant="ghost" type="button" title="Página anterior" aria-label="Página anterior de activos" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
      <span>{currentPage + 1} / {pageCount}</span>
      <Button size="icon" variant="ghost" type="button" title="Página siguiente" aria-label="Página siguiente de activos" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight className="h-4 w-4" /></Button>
    </div>}
    {!!picked.length && <div className="space-y-1 border-t pt-2">
      <p className="text-xs font-medium">Seleccionados ({selected.length})</p>
      <div className="max-h-28 overflow-y-auto">{picked.map(a => <div key={a.id} className="flex items-center gap-2 text-xs">
        <span className="min-w-0 flex-1 break-words">{a.code} · {a.name ?? '(sin nombre)'} · {assetTypeName(a)} · {assetLocationContext(a, locations)}</span>
        <Button type="button" variant="ghost" size="icon" title={`Quitar ${a.code} de la selección`} aria-label={`Quitar ${a.code} de la selección`} onClick={() => onChange(setAssetSelection(selected, [a.id], false))}><X className="h-3 w-3" /></Button>
      </div>)}</div>
    </div>}
  </div>;
}