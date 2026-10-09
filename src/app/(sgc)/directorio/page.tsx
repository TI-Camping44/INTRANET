import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Mail, Phone, Users } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { PestanasListado } from "@/components/comunes/pestanas-listado";
import { Organigrama } from "@/app/(sgc)/directorio/organigrama";
import { Avatar, AvatarImagen, AvatarRespaldo } from "@/components/ui/avatar";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { puedeEditarElOrganigrama, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { iniciales } from "@/lib/utilidades";

export const metadata: Metadata = { title: "Directorio" };
export const dynamic = "force-dynamic";

interface FilaDirectorio {
  clave: string;
  usuario_id: string | null;
  nombre_completo: string;
  correo: string;
  telefono: string | null;
  url_avatar: string | null;
  puesto_id: string | null;
  puesto_secundario_id: string | null;
  proceso_nombre: string | null;
  departamento: string | null;
  empresa_del_puesto: string | null;
  ingreso: boolean;
  lider_clave: string | null;
  lider_manual: boolean;
}

/**
 * El departamento de Odoo viene como una ruta entera —«Presidencia /
 * Comercial y Marketing / Ventas / Mayorista»— y en una tarjeta no
 * entra. Se muestra el último tramo, que es el que ubica a la persona.
 */
function areaDelDepartamento(departamento: string | null): string | null {
  if (!departamento) return null;
  const tramos = departamento
    .split("/")
    .map((t) => t.trim())
    .filter(Boolean);
  return tramos.at(-1) ?? null;
}

/**
 * El directorio: quién es quién, y nada más.
 *
 * SALE DEL PADRÓN, NO DE QUIÉN SE CONECTÓ. Leía `usuarios`, que solo
 * tiene a quien entró alguna vez con Google, así que con dos cuentas
 * creadas mostraba dos personas y no servía para nada. El dato ya
 * estaba: el padrón de la nómina tiene a todos con su puesto y su área.
 * Ahora las dos fuentes se unen en `vista_directorio`, que para quien ya
 * ingresó usa su perfil —el que el Administrador SGC pudo haber
 * ajustado— y para el resto, el padrón.
 *
 * La vista deja afuera la cédula y la fecha de ingreso: el directorio lo
 * abre cualquiera y eso no es para cualquiera.
 *
 * TENÍA TRES PESTAÑAS Y QUEDÓ CON UNA. Dirección pidió el 5 de octubre
 * sacar el organigrama y la lista de perfiles de puesto. Los perfiles
 * ya viven en Personas · Perfil de Resultados de Puesto, que es donde se
 * cargan y se editan; tenerlos acá también era un segundo lugar donde
 * buscar lo mismo. De cada persona se sigue llegando a la ficha de su
 * puesto, que es el camino que la gente usa: se entra por el nombre.
 */
export default async function PaginaDirectorio({
  searchParams,
}: {
  searchParams: { q?: string; vista?: string };
}) {
  const vista =
    searchParams.vista === "organigrama" ? "organigrama" : "personas";
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  // Los puestos se traen aparte para resolver el nombre y el área de
  // cada uno: la vista no es una tabla con claves foráneas, así que
  // PostgREST no puede embeberlos.
  const [{ data }, { data: puestosCargados }] = await Promise.all([
    supabase.from("vista_directorio").select("*").order("nombre_completo"),
    supabase
      .from("puestos")
      .select("id, nombre, area")
      .eq("activo", true)
      .order("nombre"),
  ]);

  const puestos =
    (puestosCargados as
      | { id: string; nombre: string; area: string | null }[]
      | null) ?? [];
  const puestoPorId = new Map(puestos.map((puesto) => [puesto.id, puesto]));

  const personas = ((data ?? []) as unknown as FilaDirectorio[]).map(
    (persona) => {
      const puesto = persona.puesto_id
        ? puestoPorId.get(persona.puesto_id)
        : undefined;
      const segundo = persona.puesto_secundario_id
        ? puestoPorId.get(persona.puesto_secundario_id)
        : undefined;

      return {
        ...persona,
        puesto: puesto ?? null,
        segundo: segundo ?? null,
        area: puesto?.area ?? areaDelDepartamento(persona.departamento),
      };
    },
  );

  const pendientes = personas.filter((persona) => !persona.ingreso).length;

  // El buscador filtra en el servidor sobre lo que RLS ya dejo ver.
  const texto = (searchParams.q ?? "").trim().toLowerCase();
  const filtradas = texto
    ? personas.filter((persona) =>
        [
          persona.nombre_completo,
          persona.correo,
          persona.puesto?.nombre ?? "",
          persona.area ?? "",
          persona.departamento ?? "",
          persona.segundo?.nombre ?? "",
          persona.proceso_nombre ?? "",
          persona.empresa_del_puesto ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(texto),
      )
    : personas;

  return (
    <>
      <EncabezadoPagina
        titulo="Directorio"
        descripcion="Quién es quién en Camping 44 y el perfil de su puesto."
      />

      <PestanasListado
        nombre="vista"
        actual={vista}
        ruta="/directorio"
        parametros={{ q: searchParams.q }}
        vistas={[
          {
            valor: "personas",
            etiqueta: "Personas",
            cantidad: personas.length,
          },
          { valor: "organigrama", etiqueta: "Organigrama" },
        ]}
      />

      {/* El buscador acota la grilla. En el organigrama no tiene sentido:
          sacar a una persona del árbol le corta la rama a su gente. */}
      {vista === "personas" ? (
        <div className="mb-3 mt-3">
          <FiltrosListado
            campos={[]}
            marcadorBusqueda="Buscar por nombre, puesto o departamento…"
          />
        </div>
      ) : null}

      {vista === "organigrama" ? (
        <div className="mt-3">
          <Organigrama
            nodos={personas.map((persona) => ({
              clave: persona.clave,
              nombre_completo: persona.nombre_completo,
              puesto_id: persona.puesto_id,
              puesto: persona.puesto?.nombre ?? null,
              area: persona.area,
              url_avatar: persona.url_avatar,
              ingreso: persona.ingreso,
              lider_clave: persona.lider_clave,
              lider_manual: persona.lider_manual,
              empresa: persona.empresa_del_puesto,
            }))}
            puedeEditar={puedeEditarElOrganigrama(usuario)}
          />
        </div>
      ) : (
        <>
          {filtradas.length === 0 ? (
            <EstadoVacio
              icono={<Users className="size-6" />}
              titulo={
                personas.length === 0
                  ? "Sin personas cargadas"
                  : "Nadie coincide con esa búsqueda"
              }
              descripcion={
                personas.length === 0
                  ? "La nómina se carga desde la exportación de Odoo, en Configuraciones · Padrón de la nómina."
                  : "Pruebe con otro nombre, puesto o departamento."
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtradas.map((persona) => (
                <Tarjeta key={persona.clave} className="p-3">
                  <div className="flex gap-3">
                    <Avatar className="size-10 shrink-0">
                      {persona.url_avatar ? (
                        <AvatarImagen
                          src={persona.url_avatar}
                          alt={persona.nombre_completo}
                        />
                      ) : null}
                      <AvatarRespaldo className="text-xs">
                        {iniciales(persona.nombre_completo)}
                      </AvatarRespaldo>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">
                        {persona.nombre_completo}
                      </p>

                      {persona.puesto_id && persona.puesto ? (
                        <Link
                          href={`/recursos-humanos/puestos/${persona.puesto_id}`}
                          className="flex items-center gap-1 truncate text-[11px]
                                 text-atenuado-contraste hover:text-primario"
                          title="Ver el perfil del puesto"
                        >
                          <span className="truncate">
                            {persona.puesto.nombre}
                          </span>
                          <FileText className="size-3 shrink-0" />
                        </Link>
                      ) : (
                        <p className="truncate text-[11px] text-atenuado-contraste">
                          Sin puesto asignado
                        </p>
                      )}

                      {/* El segundo puesto, cuando ocupa dos. */}
                      {persona.puesto_secundario_id && persona.segundo ? (
                        <Link
                          href={`/recursos-humanos/puestos/${persona.puesto_secundario_id}`}
                          className="flex items-center gap-1 truncate text-[11px]
                                 text-atenuado-contraste hover:text-primario"
                          title="Segundo puesto. Ver su perfil"
                        >
                          <span className="truncate">
                            y {persona.segundo.nombre}
                          </span>
                          <FileText className="size-3 shrink-0" />
                        </Link>
                      ) : null}

                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {persona.area ? (
                          <Insignia variante="contorno">
                            {persona.area}
                          </Insignia>
                        ) : null}

                        {/* Quién todavía no se conectó. Es dato útil para
                        seguir la puesta en marcha, no un reproche: va
                        en gris, del mismo tamaño que el resto. */}
                        {!persona.ingreso ? (
                          <Insignia
                            variante="neutra"
                            title="Figura en la nómina y todavía no ingresó"
                          >
                            Sin ingresar
                          </Insignia>
                        ) : null}
                      </div>

                      <div className="mt-2 space-y-0.5">
                        <a
                          href={`mailto:${persona.correo}`}
                          className="flex items-center gap-1.5 text-[11px] text-atenuado-contraste hover:text-primario"
                        >
                          <Mail className="size-3 shrink-0" />
                          <span className="truncate">{persona.correo}</span>
                        </a>
                        {persona.telefono ? (
                          <a
                            href={`tel:${persona.telefono}`}
                            className="flex items-center gap-1.5 text-[11px] text-atenuado-contraste hover:text-primario"
                          >
                            <Phone className="size-3 shrink-0" />
                            {persona.telefono}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Tarjeta>
              ))}
            </div>
          )}
        </>
      )}

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {filtradas.length} de {personas.length} persona
        {personas.length === 1 ? "" : "s"}
        {pendientes > 0
          ? ` · ${pendientes} todavía no ingresaron al sistema`
          : ""}
        . El perfil de cada puesto se adjunta en Personas · Perfil de Resultados
        de Puesto.
      </p>
    </>
  );
}
