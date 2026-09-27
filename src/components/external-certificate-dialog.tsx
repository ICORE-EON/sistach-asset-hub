import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { certificateKeys, certificateService } from "@/modules/maintenance/services/certificates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string;
}

export function ExternalCertificateDialog({ open, onOpenChange, companyId }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [issuerName, setIssuerName] = useState("");
  const [issuerRole, setIssuerRole] = useState("");
  const [provider, setProvider] = useState("");
  const [externalNumber, setExternalNumber] = useState("");
  const [issuedOn, setIssuedOn] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState("");
  const [assetId, setAssetId] = useState("none");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: assets = [] } = useQuery({
    queryKey: certificateKeys.externalAssets(companyId),
    enabled: open,
    queryFn: () => certificateService.listAssetsForExternal(companyId),
  });

  const reset = () => {
    setTitle("");
    setIssuerName("");
    setIssuerRole("");
    setProvider("");
    setExternalNumber("");
    setIssuedOn(new Date().toISOString().slice(0, 10));
    setValidUntil("");
    setAssetId("none");
    setNotes("");
    setFile(null);
  };

  const create = useMutation({
    mutationFn: () =>
      certificateService.registerExternal(companyId, {
        title, issuerName, issuerRole, provider, externalNumber, issuedOn, validUntil, assetId, notes, file,
      }),
    onSuccess: (cert) => {
      toast.success(`Certificado ${cert.code} registrado`);
      qc.invalidateQueries({ queryKey: certificateKeys.lists(companyId) });
      reset();
      onOpenChange(false);
      navigate({ to: "/certificates/$id", params: { id: cert.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar certificado externo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Certificado anual extintor" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Proveedor externo *</Label>
              <Input value={provider} onChange={(e) => setProvider(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nº certificado externo</Label>
              <Input value={externalNumber} onChange={(e) => setExternalNumber(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Emisor</Label>
              <Input value={issuerName} onChange={(e) => setIssuerName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input value={issuerRole} onChange={(e) => setIssuerRole(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Emitido el *</Label>
              <Input type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Válido hasta</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Activo cubierto</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin activo específico</SelectItem>
                {assets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} · {a.name ?? ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>PDF del certificado *</Label>
            <Input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                <Upload className="mr-1 inline h-3 w-3" />
                {file.name}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Registrando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
