"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { marcarTodasLeidas } from "@/app/(sgc)/acciones-notificaciones";

export function BotonMarcarTodas() {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);

  async function marcar() {
    definirProcesando(true);
    const resultado = await marcarTodasLeidas();
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Notificaciones marcadas.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <Boton variante="contorno" tamano="pequeno" onClick={marcar} disabled={procesando}>
      <CheckCheck /> Marcar todas como leídas
    </Boton>
  );
}
