import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function ModulePlaceholder({ icon: Icon, title, description }: Props) {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <Badge variant="secondary">Próximamente</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Este módulo se construirá en el siguiente paso.
        </CardContent>
      </Card>
    </div>
  );
}
