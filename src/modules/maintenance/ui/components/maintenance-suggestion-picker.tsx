import { useState } from 'react';
import { MAINTENANCE_SUGGESTIONS, suggestionAlreadyApplied, type MaintenanceSuggestion } from '../../domain/maintenance-suggestions';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export function MaintenanceSuggestionPicker({ plans, onSelect }: {
  plans: Array<{ code: string; name: string }>;
  onSelect: (s: MaintenanceSuggestion) => void;
}) {
  const [group, setGroup] = useState('all');
  const [selected, setSelected] = useState('');
  const [applied, setApplied] = useState('');
  const suggestion = MAINTENANCE_SUGGESTIONS.find(s => s.id === selected);
  return <section className="space-y-3 border-b pb-4">
    <Label>Sugerencias de mantenimiento (opcional)</Label>
    <div className="flex flex-wrap gap-2">
      <Select value={group} onValueChange={v => { setGroup(v); setSelected(''); }}>
        <SelectTrigger className="w-full sm:w-40" aria-label="Familia de sugerencias"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">Todas</SelectItem>{[...new Set(MAINTENANCE_SUGGESTIONS.map(s => s.group))].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="h-auto min-h-9 min-w-0 flex-1 whitespace-normal text-left [&>span]:line-clamp-none" aria-label="Tarea sugerida"><SelectValue placeholder="Sin sugerencia" /></SelectTrigger>
        <SelectContent>{MAINTENANCE_SUGGESTIONS.filter(s => group === 'all' || s.group === group).map(s => <SelectItem className="whitespace-normal" key={s.id} value={s.id} disabled={suggestionAlreadyApplied(s, plans)}>{s.name}{suggestionAlreadyApplied(s, plans) ? ' · Ya existe' : ''}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    {suggestion && <><p className="text-sm text-muted-foreground">{suggestion.description}</p>
      <p className="text-xs text-muted-foreground">{suggestion.frequency ? `Frecuencia propuesta: ${suggestion.frequency === 'quarterly' ? 'trimestral' : 'anual'} · Orientativa, requiere validación` : 'Frecuencia: a definir por empresa'}</p>
      <p role="status" className="text-xs text-muted-foreground">{applied === selected ? 'Sugerencia aplicada · Puedes revisar y modificar los datos antes de guardar.' : 'Vista previa, aún no aplicada · Los campos actuales se conservan hasta pulsar Usar sugerencia.'}</p>
      <Button type="button" variant="outline" onClick={() => { onSelect(suggestion); setApplied(suggestion.id); }} disabled={suggestionAlreadyApplied(suggestion, plans)}>Usar sugerencia</Button></>}
    <p className="text-xs text-muted-foreground">Sin periodicidad reglamentaria fijada · Origen sin especificar</p>
  </section>;
}