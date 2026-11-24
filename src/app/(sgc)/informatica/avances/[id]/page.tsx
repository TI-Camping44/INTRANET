import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { HistorialBitacora } from "@/components/comunes/historial-bitacora";
import { NombreDeEmpresa } from "@/components/comunes/marca-empresa";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { obtenerPermisos, requerirModulo } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha, formatearFechaHora } from "@/lib/formato";
import { nombrePorEmpresa, type EmpresaDelGrupo } from "@/lib/empresas";
import {
  ETIQUETAS_SISTEMA_AVANCE,
  ETIQUETAS_TIPO_AVANCE,
  VARIANTE_TIPO_AVANCE,
  esSistemaAvance,
  esTipoAvance,
} from "@/lib/avances-ti";
import { EliminarAvance } from "@/app/(sgc)/informatica/avances/[id]/eliminar-avance";

export const metadata: Metadata = { title: "Avance de TI" };
export const dynamic = "force-dynamic";

interface Avance {
  id: string;
  fecha: string;
  titulo: string;
  tipo: string;
  sistema: string;
  empresa_afectada_id: string | null;
  ticket: string | null;
  descripcion: string;
  impacto: string | null;
  creado_en: string;
  actualizado_en: string;
  autor: { nombre_completo: string } | null;
}

/** Ficha de un avance de TI: qué se hizo, dónde y su historial. */
export default async function PaginaAvance({ params }: { params: { id: string } }) {
  await requerirModulo("informatica");
  const permisos = await obtenerPermisos();
  const puedeEditar = permisos.informatica.editar;
  const supabase = crearClienteServidor();

  const [{ data }, { data: datosEmpresas }] = await Promise.all([
    supabase
      .from("avances_ti")
      .select(
        "id, fecha, titulo, tipo, sistema, empresa_afectada_id, ticket, descripcion, impacto, " +
          "creado_en, actualizado_en, autor:creado_por (nombre_completo)",
      )
      .eq("id", params.id)
      .maybeSingle(),
    supabase.rpc("empresas_del_grupo"),
  ]);

  if (!data) notFound();
  const avance = data as unknown as Avance;
  const empresas = nombrePorEmpresa((datosEmpresas as EmpresaDelGrupo[] | null) ?? []);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href="/informatica/avances"
          className="inline-flex items-center gap-1 text-xs text-atenuado-contraste hover:text-texto"
        >
          <ArrowLeft className="size-3" aria-hidden />
          Avances y cambios
        </Link>
      </div>

      <EncabezadoPagina
        titulo={avance.titulo}
        acciones={
          puedeEditar ? (
            <div className="flex flex-wrap gap-2">
              <Boton comoHijo variante="contorno" tamano="pequeno">
                <Link href={`/informatica/avances/${avance.id}/editar`}>
                  <Pencil aria-hidden />
                  Editar
                </Link>
              </Boton>
              <EliminarAvance avanceId={avance.id} titulo={avance.titulo} />
            </div>
          ) : null
        }
      />

      <Tarjeta>
        <TarjetaContenido className="pt-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-atenuado-contraste">Fecha</dt>
              <dd className="tabular mt-0.5 font-medium">{formatearFecha(avance.fecha)}</dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Tipo</dt>
              <dd className="mt-0.5">
                {esTipoAvance(avance.tipo) ? (
                  <Insignia variante={VARIANTE_TIPO_AVANCE[avance.tipo]}>
                    {ETIQUETAS_TIPO_AVANCE[avance.tipo]}
                  </Insignia>
                ) : (
                  avance.tipo
                )}
              </dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Sistema</dt>
              <dd className="mt-0.5 font-medium">
                {esSistemaAvance(avance.sistema)
                  ? ETIQUETAS_SISTEMA_AVANCE[avance.sistema]
                  : avance.sistema}
              </dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Empresa</dt>
              <dd className="mt-0.5 font-medium">
                <NombreDeEmpresa
                  nombre={
                    avance.empresa_afectada_id
                      ? empresas.get(avance.empresa_afectada_id)
                      : null
                  }
                  vacio="Las dos"
                />
              </dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Ticket</dt>
              <dd className="tabular mt-0.5 font-medium">{avance.ticket ?? "Sin ticket"}</dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Registró</dt>
              <dd className="mt-0.5 font-medium">
                {avance.autor?.nombre_completo ?? "—"}
                <span className="block font-normal text-atenuado-contraste">
                  {formatearFechaHora(avance.creado_en)}
                </span>
              </dd>
            </div>
          </dl>
        </TarjetaContenido>
      </Tarjeta>

      <Tarjeta>
        <TarjetaCabecera>
          <TarjetaTitulo className="text-sm">Qué se hizo</TarjetaTitulo>
        </TarjetaCabecera>
        <TarjetaContenido>
          <p className="whitespace-pre-line text-sm leading-relaxed">{avance.descripcion}</p>
        </TarjetaContenido>
      </Tarjeta>

      {avance.impacto ? (
        <Tarjeta>
          <TarjetaCabecera>
            <TarjetaTitulo className="text-sm">Qué cambia para la gente</TarjetaTitulo>
          </TarjetaCabecera>
          <TarjetaContenido>
            <p className="whitespace-pre-line text-sm leading-relaxed">{avance.impacto}</p>
          </TarjetaContenido>
        </Tarjeta>
      ) : null}

      <Tarjeta>
        <TarjetaCabecera>
          <TarjetaTitulo className="text-sm">Trazabilidad</TarjetaTitulo>
        </TarjetaCabecera>
        <TarjetaContenido>
          <HistorialBitacora tablas={["avances_ti"]} registroId={avance.id} />
        </TarjetaContenido>
      </Tarjeta>
    </div>
  );
}
