import { differenceInCalendarDays } from "date-fns";

export type CertExpiryState = "no_expiry" | "valid" | "expiring" | "expired";

export interface CertExpiryInfo {
  state: CertExpiryState;
  daysLeft: number | null;
  label: string;
  className: string;
}

export function getCertExpiry(validUntil: string | null | undefined): CertExpiryInfo {
  if (!validUntil) {
    return {
      state: "no_expiry",
      daysLeft: null,
      label: "Sin caducidad",
      className: "bg-muted text-muted-foreground",
    };
  }
  const days = differenceInCalendarDays(new Date(validUntil), new Date());
  if (days < 0) {
    return {
      state: "expired",
      daysLeft: days,
      label: "Caducado",
      className: "bg-destructive/15 text-destructive",
    };
  }
  if (days <= 30) {
    return {
      state: "expiring",
      daysLeft: days,
      label: `Caduca en ${days}d`,
      className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
    };
  }
  return {
    state: "valid",
    daysLeft: days,
    label: "Vigente",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  };
}

export const CERT_STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  issued: { label: "Emitido", variant: "default" },
  superseded: { label: "Reemplazado", variant: "outline" },
  revoked: { label: "Revocado", variant: "destructive" },
};
