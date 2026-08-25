import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Avatar, AvatarImagen, AvatarRespaldo } from "@/components/ui/avatar";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { NIVELES_COMPETENCIA } from "@/lib/constantes";
import { iniciales } from "@/lib/utilidades";

export const dynamic = "force-dynamic";

interface PuestoDetalle {
  id: string;
  codigo: string;
  nombre: string;
  area: string | null;
  mision: string | null;
  codigo_formulario: string;
  revision: number;
  supervisado_por: string | null;
  reemplazado_por: string | null;
  responsabilidades_generales: string | null;
  funciones: string[];
  formacion_academica: string | null;
  formacion_complementaria: string | null;
  experiencia: string | null;
  requiere_registro_conducir: boolean;
  requiere_movilidad_propia: boolean;
  requiere_viajes_interior: boolean;
  requiere_viajes_exterior: boolean;
  requiere_horario_extendido: boolean;
  url_documento: string | null;
  procesos: { nombre: string } | null;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("puestos")
    .select("nombre")
    .eq("id", params.id)
    .maybeSingle();

  return { title: data ? `Perfil · ${data.nombre}` : "Perfil de puesto" };
}

export default async function PaginaPuesto({ params }: { params: { id: string } }) {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: consulta } = await supabase
    .from("puestos")
    .select("*, procesos:proceso_id (nombre)")
    .eq("id", params.id)
    .maybeSingle();

  const puesto = consulta as unknown as PuestoDetalle | null;
  if (!puesto) notFound();

  const [{ data: ocupantes }, { data: requisitos }] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, nombre_completo, correo, url_avatar")
      .eq("puesto_id", params.id)
      .eq("activo", true)
      .order("nombre_completo"),
    supabase
      .from("puesto_competencias")
      .select("nivel_requerido, critica, competencias:competencia_id (codigo, nombre)")
      .eq("puesto_id", params.id),
  ]);

  const personas = (ocupantes ?? []) as {
    id: string;
    nombre_completo: string;
    correo: string;
    url_avatar: string | null;
  }[];

  const exigencias = (requisitos ?? []) as unknown as {
    nivel_requerido: number;
    critica: boolean;
    competencias: { codigo: string; nombre: string } | null;
  }[];

  // Los "otros requerimientos" del formulario son casilleros de si o no.
  // Se listan solo los que aplican: una lista con cinco "N/A" no informa.
  const requerimientos = [
    [puesto.requiere_registro_conducir, "Registro de conducir"],
    [puesto.requiere_movilidad_propia, "Movilidad propia"],
    [puesto.requiere_viajes_interior, "Viajes al interior"],
    [puesto.requiere_viajes_exterior, "Viajes al exterior"],
    [puesto.requiere_horario_extendido, "Disponibilidad horaria"],
  ].filter(([aplica]) => aplica) as [boolean, string][];

  return (
    <div className="mx-auto max-w-5xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/recursos-humanos">
          <ArrowLeft /> Volver a recursos humanos
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={puesto.nombre}
        descripcion={puesto.area ?? undefined}
        acciones={
          puesto.url_documento ? (
            <Boton variante="contorno" tamano="pequeno" comoHijo>
              <a href={puesto.url_documento} target="_blank" rel="noreferrer">
                <ExternalLink /> Ver el documento
              </a>
            </Boton>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Insignia variante="primaria" className="tabular text-xs">
          {puesto.codigo}
        </Insignia>
        <Insignia variante="contorno" className="tabular">
          {puesto.codigo_formulario} · Rev. {String(puesto.revision).padStart(2, "0")}
        </Insignia>
        {puesto.procesos ? (
          <Insignia variante="contorno">{puesto.procesos.nombre}</Insignia>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {puesto.mision ? (
            <Tarjeta>
              <TarjetaCabecera>
                <TarjetaTitulo>Descripción del puesto</TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido>
                <p className="text-xs leading-relaxed">{puesto.mision}</p>
              </TarjetaContenido>
            </Tarjeta>
          ) : null}

          {puesto.responsabilidades_generales ? (
            <Tarjeta>
              <TarjetaCabecera>
                <TarjetaTitulo>Responsabilidades generales</TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido>
                <p className="text-xs leading-relaxed">{puesto.responsabilidades_generales}</p>
              </TarjetaContenido>
            </Tarjeta>
          ) : null}

          {puesto.funciones.length > 0 ? (
            <Tarjeta>
              <TarjetaCabecera>
                <TarjetaTitulo>
                  Funciones propias del puesto ({puesto.funciones.length})
                </TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido>
                <ol className="space-y-2">
                  {puesto.funciones.map((funcion, indice) => (
                    <li key={funcion} className="flex gap-2.5 text-xs leading-relaxed">
                      <span className="shrink-0 tabular text-atenuado-contraste">
                        {String(indice + 1).padStart(2, "0")}
                      </span>
                      <span>{funcion}</span>
                    </li>
                  ))}
                </ol>
              </TarjetaContenido>
            </Tarjeta>
          ) : null}

          {exigencias.length > 0 ? (
            <Tarjeta>
              <TarjetaCabecera>
                <TarjetaTitulo>Competencias exigidas</TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido>
                <ul className="space-y-1.5">
                  {exigencias.map((exigencia) => (
                    <li
                      key={exigencia.competencias?.codigo}
                      className="flex items-baseline justify-between gap-3 text-xs"
                    >
                      <span>
                        <span className="tabular text-atenuado-contraste">
                          {exigencia.competencias?.codigo}
                        </span>{" "}
                        {exigencia.competencias?.nombre}
                        {exigencia.critica ? (
                          <Insignia variante="atencion" className="ml-2">
                            Crítica
                          </Insignia>
                        ) : null}
                      </span>
                      <span className="shrink-0 font-medium">
                        Nivel {exigencia.nivel_requerido} ·{" "}
                        {NIVELES_COMPETENCIA[exigencia.nivel_requerido]}
                      </span>
                    </li>
                  ))}
                </ul>
              </TarjetaContenido>
            </Tarjeta>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Dependencia</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <dl className="space-y-2.5 text-xs">
                <Dato etiqueta="Supervisado por" valor={puesto.supervisado_por ?? "—"} />
                <Dato
                  etiqueta="Reemplazado por"
                  valor={puesto.reemplazado_por ?? "Sin definir"}
                />
              </dl>
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Requisitos</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <dl className="space-y-2.5 text-xs">
                <DatoLargo
                  etiqueta="Formación académica"
                  valor={puesto.formacion_academica ?? "—"}
                />
                <DatoLargo
                  etiqueta="Formación complementaria"
                  valor={puesto.formacion_complementaria ?? "—"}
                />
                <DatoLargo etiqueta="Experiencia" valor={puesto.experiencia ?? "—"} />
              </dl>

              {requerimientos.length > 0 ? (
                <div className="mt-3 border-t border-borde pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste">
                    Otros requerimientos
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {requerimientos.map(([, etiqueta]) => (
                      <Insignia key={etiqueta} variante="contorno">
                        {etiqueta}
                      </Insignia>
                    ))}
                  </div>
                </div>
              ) : null}
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Quién ocupa el puesto</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              {personas.length === 0 ? (
                <p className="text-xs text-atenuado-contraste">
                  Todavía no hay nadie asignado a este puesto.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {personas.map((persona) => (
                    <li key={persona.id} className="flex items-center gap-2.5">
                      <Avatar className="size-8 shrink-0">
                        {persona.url_avatar ? (
                          <AvatarImagen src={persona.url_avatar} alt={persona.nombre_completo} />
                        ) : null}
                        <AvatarRespaldo className="text-[10px]">
                          {iniciales(persona.nombre_completo)}
                        </AvatarRespaldo>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{persona.nombre_completo}</p>
                        <p className="truncate text-[11px] text-atenuado-contraste">
                          {persona.correo}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TarjetaContenido>
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-atenuado-contraste">{etiqueta}</dt>
      <dd className="text-right font-medium">{valor}</dd>
    </div>
  );
}

function DatoLargo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-atenuado-contraste">{etiqueta}</dt>
      <dd className="mt-0.5 leading-relaxed">{valor}</dd>
    </div>
  );
}
