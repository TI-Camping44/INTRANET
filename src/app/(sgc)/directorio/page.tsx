import type { Metadata } from "next";
import { Mail, Phone, Users } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { Avatar, AvatarImagen, AvatarRespaldo } from "@/components/ui/avatar";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import {
  Pestanas,
  PestanaContenido,
  PestanaDisparador,
  PestanasLista,
} from "@/components/ui/pestanas";
import { Tarjeta } from "@/components/ui/tarjeta";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { iniciales } from "@/lib/utilidades";
import { Organigrama, type Persona } from "./organigrama";

export const metadata: Metadata = { title: "Directorio" };
export const dynamic = "force-dynamic";

export default async function PaginaDirectorio({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data } = await supabase
    .from("usuarios")
    .select(
      "id, nombre_completo, correo, telefono, url_avatar, superior_id," +
        " puestos:puesto_id (nombre, area), procesos:proceso_id (nombre)",
    )
    .eq("activo", true)
    .order("nombre_completo");

  const personas = (data ?? []) as unknown as Persona[];

  // El buscador filtra en el servidor sobre lo que RLS ya dejo ver.
  const texto = (searchParams.q ?? "").trim().toLowerCase();
  const filtradas = texto
    ? personas.filter((persona) =>
        [
          persona.nombre_completo,
          persona.correo,
          persona.puestos?.nombre ?? "",
          persona.puestos?.area ?? "",
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
        descripcion="Quién es quién en Camping 44, y a quién le reporta cada uno."
      />

      <Pestanas defaultValue="personas">
        <PestanasLista>
          <PestanaDisparador value="personas">Personas ({personas.length})</PestanaDisparador>
          <PestanaDisparador value="organigrama">Organigrama</PestanaDisparador>
        </PestanasLista>

        <PestanaContenido value="personas">
          <div className="mb-3">
            <FiltrosListado campos={[]} marcadorBusqueda="Buscar por nombre, puesto o área…" />
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
                  : "Pruebe con otro nombre, puesto o área."
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
                      <p className="truncate text-[11px] text-atenuado-contraste">
                        {persona.puestos?.nombre ?? "Sin puesto asignado"}
                      </p>

                      {persona.puestos?.area || persona.procesos?.nombre ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {persona.puestos?.area ? (
                            <Insignia variante="contorno">{persona.puestos.area}</Insignia>
                          ) : null}
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
        </PestanaContenido>

        <PestanaContenido value="organigrama">
          <Tarjeta className="p-4">
            <Organigrama personas={personas} />
          </Tarjeta>
        </PestanaContenido>
      </Pestanas>
    </>
  );
}
