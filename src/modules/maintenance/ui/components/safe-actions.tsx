/**
 * Small confirmation dialogs shared by the 2A actions (eliminar sin evidencias, motivos de
 * cancelar/desvincular). The server is the authority: these only show its answer.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DeleteCheck } from "../../contracts/repositories";

const msg = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e));

export function SafeDeleteDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  check: () => Promise<DeleteCheck>;
  confirm: () => Promise<DeleteCheck>;
  impact: (c: DeleteCheck) => ReactNode;
  blockedHint: string;
  onDeleted: (c: DeleteCheck) => void;
}) {
  const { open, check } = props;
  const [state, setState] = useState<{ loading: boolean; result?: DeleteCheck; error?: string }>({ loading: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setState({ loading: true });
    check().then((result) => alive && setState({ loading: false, result }))
      .catch((e) => alive && setState({ loading: false, error: msg(e) }));
    return () => { alive = false; };
  }, [open, check]);

  const r = state.result;
  const run = async () => {
    setBusy(true);
    try {
      const out = await props.confirm();
      if (out.deleted || out.already) { props.onOpenChange(false); props.onDeleted(out); }
      else setState({ loading: false, result: out });
    } catch (e) { setState({ loading: false, error: msg(e) }); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>La eliminación es definitiva y solo se permite si no hay historial ni evidencias.</DialogDescription>
        </DialogHeader>
        {state.loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Comprobando…</p>}
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        {r && !r.eligible && (
          <div className="space-y-2 text-sm">
            <p className="font-medium">No se puede eliminar porque:</p>
            <ul className="list-disc pl-5">{r.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
            <p className="text-muted-foreground">{props.blockedHint}</p>
          </div>
        )}
        {r && r.eligible && <div className="space-y-1 text-sm">{props.impact(r)}</div>}
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>Cerrar</Button>
          {r?.eligible && (
            <Button variant="destructive" disabled={busy} onClick={run}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Eliminar definitivamente
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReasonDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  required?: boolean;
  destructive?: boolean;
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (props.open) { setReason(""); setError(null); } }, [props.open]);
  const missing = props.required !== false && !reason.trim();
  const run = async () => {
    setBusy(true); setError(null);
    try { await props.onConfirm(reason.trim()); props.onOpenChange(false); }
    catch (e) { setError(msg(e)); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription asChild><div>{props.description}</div></DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason-text">Motivo{props.required !== false ? " *" : " (opcional)"}</Label>
          <Textarea id="reason-text" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>Volver</Button>
          <Button variant={props.destructive ? "destructive" : "default"} disabled={busy || missing} onClick={run}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{props.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
