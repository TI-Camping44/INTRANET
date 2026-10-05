import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Mail, Phone, Users } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { Avatar, AvatarImagen, AvatarRespaldo } from "@/components/ui/avatar";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { iniciales } from "@/lib/utilidades";

export const metadata: Metadata = { title: "Directorio" };
export const dynamic = "force-dynamic";

interface Persona {
  id: string;
  nombre_completo: string;
  correo: string;
  telefono: string | null;
  url_avatar: string | null;
  puesto_id: string | null;
  puestos: { nombre: string; area: string | null } | null;
  /** El segundo puesto, cuando la persona ocupa dos. */
  puesto_secundario_id: string | null;
  segundo: { nombre: string; area: string | null } | null;
  procesos: { nombre: string } | null;
}

/**
 * El directorio: quién es quién, y nada más.
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
  searchParams: { q?: string };
}) {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  // Los puestos se traen solo para resolver el nombre del segundo puesto
  // de cada persona. `usuarios` tiene dos claves foráneas a `puestos` y
  // embeber las dos en el mismo select depende de cómo PostgREST
  // desambigüe el enlace; con la lista a mano no hace falta.
  const [{ data }, { data: puestosCargados }] = await Promise.all([
    supabase
      .from("usuarios")
      .select(
        "id, nombre_completo, correo, telefono, url_avatar, puesto_id," +
          " puesto_secundario_id, puestos:puesto_id (nombre, area)," +
          " procesos:proceso_id (nombre)",
      )
      .eq("activo", true)
      .order("nombre_completo"),
    supabase
      .from("puestos")
      .select("id, nombre, area")
      .eq("activo", true)
      .order("nombre"),
  ]);

  const puestos =
    (puestosCargados as { id: string; nombre: string; area: string | null }[] | null) ?? [];
  const puestoPorId = new Map(puestos.map((puesto) => [puesto.id, puesto]));

  const personas: Persona[] = ((data ?? []) as unknown as Persona[]).map((persona) => {
    const segundo = persona.puesto_secundario_id
      ? puestoPorId.get(persona.puesto_secundario_id)
      : undefined;

    return {
      ...persona,
      segundo: segundo ? { nombre: segundo.nombre, area: segundo.area } : null,
    };
  });

  // El buscador filtra en el servidor sobre lo que RLS ya dejo ver.
  const texto = (searchParams.q ?? "").trim().toLowerCase();
  const filtradas = texto
    ? personas.filter((persona) =>
        [
          persona.nombre_completo,
          persona.correo,
          persona.puestos?.nombre ?? "",
          persona.puestos?.area ?? "",
          persona.segundo?.nombre ?? "",
          persona.procesos?.nombre ?? "",
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

      <div className="mb-3">
        <FiltrosListado campos={[]} marcadorBusqueda="Buscar por nombre, puesto o departamento…" />
      </div>

      {filtradas.length === 0 ? (
        <EstadoVacio
          icono={<Users className="size-6" />}
          titulo={
            personas.length === 0 ? "Sin personas cargadas" : "Nadie coincide con esa búsqueda"
          }
          descripcion={
            personas.length === 0
              ? "Los perfiles se crean solos cuando cada persona ingresa por primera vez."
              : "Pruebe con otro nombre, puesto o departamento."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((persona) => (
            <Tarjeta key={persona.id} className="p-3">
              <div className="flex gap-3">
                <Avatar className="size-10 shrink-0">
                  {persona.url_avatar ? (
                    <AvatarImagen src={persona.url_avatar} alt={persona.nombre_completo} />
                  ) : null}
                  <AvatarRespaldo className="text-xs">
                    {iniciales(persona.nombre_completo)}
                  </AvatarRespaldo>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{persona.nombre_completo}</p>
                  {persona.puesto_id && persona.puestos ? (
                    <Link
                      href={`/recursos-humanos/puestos/${persona.puesto_id}`}
                      className="flex items-center gap-1 truncate text-[11px]
                                 text-atenuado-contraste hover:text-primario"
                      title="Ver el perfil del puesto"
                    >
                      <span className="truncate">{persona.puestos.nombre}</span>
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
                      <span className="truncate">y {persona.segundo.nombre}</span>
                      <FileText className="size-3 shrink-0" />
                    </Link>
                  ) : null}

                  {persona.puestos?.area ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <Insignia variante="contorno">{persona.puestos.area}</Insignia>
                    </div>
                  ) : null}

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

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {filtradas.length} de {personas.length} persona{personas.length === 1 ? "" : "s"}. El
        perfil de cada puesto se adjunta en Personas · Perfil de Resultados de Puesto.
      </p>
    </>
  );
}
