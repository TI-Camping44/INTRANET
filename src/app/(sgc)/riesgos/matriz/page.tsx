import type { Metadata } from "next";
import Link from "next/link";
import { List } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { MatrizRiesgos } from "@/components/comunes/matriz-riesgos";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Matriz de riesgos" };
export const dynamic = "force-dynamic";

export default async function PaginaMatriz() {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data } = await supabase
    .from("riesgos")
    .select("id, codigo, titulo, probabilidad, impacto, nivel, tipo, estado")
    .neq("estado", "cerrado")
    .order("codigo");

  const riesgos = (data ?? []) as {
    id: string;
    codigo: string;
    titulo: string;
    probabilidad: number;
    impacto: number;
    nivel: number;
    tipo: string;
  }[];

  const soloRiesgos = riesgos.filter((riesgo) => riesgo.tipo === "riesgo");
  const oportunidades = riesgos.filter((riesgo) => riesgo.tipo === "oportunidad");

  return (
    <>
      <EncabezadoPagina
        titulo="Matriz de riesgos"
        descripcion="Evaluación 5×5 de probabilidad por impacto. Cada celda enlaza a la ficha del riesgo."
        acciones={
          <Boton variante="contorno" comoHijo>
            <Link href="/riesgos">
              <List /> Ver como listado
            </Link>
          </Boton>
        }
      />

      <Tarjeta className="p-4">
        <MatrizRiesgos riesgos={soloRiesgos} />
      </Tarjeta>

      {oportunidades.length > 0 ? (
        <>
          <h2 className="mb-3 mt-6 text-sm font-semibold">Oportunidades</h2>
          <Tarjeta className="p-4">
            <MatrizRiesgos riesgos={oportunidades} />
          </Tarjeta>
        </>
      ) : null}
    </>
  );
}
