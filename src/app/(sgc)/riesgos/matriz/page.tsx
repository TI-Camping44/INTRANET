import type { Metadata } from "next";
import Link from "next/link";
import { List } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { MatrizOportunidades, MatrizRiesgos } from "@/components/comunes/matriz-riesgos";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Matriz de riesgos y oportunidades" };
export const dynamic = "force-dynamic";

interface FichaDeLaMatriz {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string;
  probabilidad: number | null;
  severidad: number | null;
  beneficio: number | null;
  factibilidad: number | null;
}

/**
 * Las dos matrices 5×5 del F-EST-01, una debajo de la otra.
 *
 * SON DOS MATRICES DISTINTAS, no la misma con dos juegos de registros.
 * El riesgo se ubica por probabilidad × severidad y la oportunidad por
 * beneficio × factibilidad, que son columnas distintas de la misma
 * tabla. Hasta hoy las dos se dibujaban con los ejes del riesgo, así que
 * la de oportunidades salía vacía: les pedía dos valores que esos
 * registros no tienen.
 */
export default async function PaginaMatriz() {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data } = await supabase
    .from("riesgos")
    .select(
      "id, codigo, titulo, tipo, probabilidad, severidad, beneficio, factibilidad",
    )
    .neq("estado", "cerrado")
    .order("codigo");

  const fichas = (data ?? []) as FichaDeLaMatriz[];
  const riesgos = fichas.filter((ficha) => ficha.tipo === "riesgo");
  const oportunidades = fichas.filter((ficha) => ficha.tipo === "oportunidad");

  return (
    <>
      <EncabezadoPagina
        titulo="Matriz de riesgos y oportunidades"
        descripcion="Las dos evaluaciones 5×5 del F-EST-01. Cada celda enlaza a la ficha."
        acciones={
          <div className="flex flex-wrap gap-2">
            <Boton variante="contorno" comoHijo>
              <Link href="/riesgos">
                <List /> Riesgos
              </Link>
            </Boton>
            <Boton variante="contorno" comoHijo>
              <Link href="/oportunidades">
                <List /> Oportunidades
              </Link>
            </Boton>
          </div>
        }
      />

      <h2 className="mb-3 text-sm font-semibold">
        Riesgos{riesgos.length > 0 ? ` · ${riesgos.length}` : ""}
      </h2>
      <Tarjeta className="p-4">
        <MatrizRiesgos riesgos={riesgos} />
      </Tarjeta>

      <h2 className="mb-3 mt-6 text-sm font-semibold">
        Oportunidades{oportunidades.length > 0 ? ` · ${oportunidades.length}` : ""}
      </h2>
      <Tarjeta className="p-4">
        <MatrizOportunidades oportunidades={oportunidades} />
      </Tarjeta>
    </>
  );
}
