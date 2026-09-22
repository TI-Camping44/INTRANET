import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Mail, Phone, Users } from "lucide-react";
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
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
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

  // El directorio pasa a ser también la puerta de Recursos Humanos: de
  // cada persona se llega a su perfil de puesto —el R-02-01— y los
  // perfiles completos tienen su propia pestaña. Es donde la gente los
  // busca: se entra por el nombre de la persona, no por el código del
  // puesto.
  const [{ data }, { data: puestosCargados }] = await Promise.all([
    supabase
      .from("usuarios")
      .select(
        "id, nombre_completo, correo, telefono, url_avatar, superior_id, puesto_id," +
          " puestos:puesto_id (nombre, area), procesos:proceso_id (nombre)",
      )
      .eq("activo", true)
      .order("nombre_completo"),
    supabase
      .from("puestos")
      .select("id, codigo, nombre, area, codigo_formulario, revision, procesos:proceso_id (nombre)")
      .eq("activo", true)
      .order("codigo"),
  ]);

  const personas = (data ?? []) as unknown as Persona[];

  const puestos = (puestosCargados ?? []) as unknown as {
    id: string;
    codigo: string;
    nombre: string;
    area: string | null;
    codigo_formulario: string;
    revision: number;
    procesos: { nombre: string } | null;
  }[];

  // Cuántas personas ocupan cada puesto. Un puesto sin nadie es un dato:
  // o está vacante o el legajo no se cargó.
  const ocupantes = new Map<string, number>();
  for (const persona of personas) {
    if (persona.puesto_id) {
      ocupantes.set(persona.puesto_id, (ocupantes.get(persona.puesto_id) ?? 0) + 1);
    }
  }

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
        descripcion="Quién es quién en Camping 44, a quién le reporta cada uno y el perfil de su puesto."
      />

      <Pestanas defaultValue="personas">
        <PestanasLista>
          <PestanaDisparador value="personas">Personas ({personas.length})</PestanaDisparador>
          <PestanaDisparador value="organigrama">Organigrama</PestanaDisparador>
          <PestanaDisparador value="puestos">
            Perfiles de puesto ({puestos.length})
          </PestanaDisparador>
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

        <PestanaContenido value="puestos">
          {puestos.length === 0 ? (
            <EstadoVacio
              icono={<Users className="size-6" />}
              titulo="Sin puestos cargados"
              descripcion="Los perfiles de puesto se cargan desde Recursos humanos."
            />
          ) : (
            <Tarjeta>
              <Tabla>
                <TablaCabecera>
                  <TablaFila>
                    <TablaEncabezado className="w-[6rem]">Código</TablaEncabezado>
                    <TablaEncabezado>Puesto</TablaEncabezado>
                    <TablaEncabezado className="hidden md:table-cell">Área</TablaEncabezado>
                    <TablaEncabezado className="hidden lg:table-cell">Proceso</TablaEncabezado>
                    <TablaEncabezado className="w-[7rem]">Formulario</TablaEncabezado>
                    <TablaEncabezado className="w-[7rem]">Ocupan</TablaEncabezado>
                  </TablaFila>
                </TablaCabecera>
                <TablaCuerpo>
                  {puestos.map((puesto) => {
                    const cuantos = ocupantes.get(puesto.id) ?? 0;

                    return (
                      <TablaFila key={puesto.id}>
                        <TablaCelda className="font-medium tabular text-xs">
                          <Link
                            href={`/recursos-humanos/puestos/${puesto.id}`}
                            className="hover:text-primario"
                          >
                            {puesto.codigo}
                          </Link>
                        </TablaCelda>
                        <TablaCelda className="text-xs">
                          <Link
                            href={`/recursos-humanos/puestos/${puesto.id}`}
                            className="hover:text-primario"
                          >
                            {puesto.nombre}
                          </Link>
                        </TablaCelda>
                        <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                          {puesto.area ?? "—"}
                        </TablaCelda>
                        <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                          {puesto.procesos?.nombre ?? "—"}
                        </TablaCelda>
                        <TablaCelda className="text-xs tabular text-atenuado-contraste">
                          {puesto.codigo_formulario} · rev. {puesto.revision}
                        </TablaCelda>
                        <TablaCelda className="text-xs">
                          {cuantos === 0 ? (
                            <span className="text-semaforo-alto">Vacante</span>
                          ) : (
                            <span className="text-atenuado-contraste">
                              {cuantos} {cuantos === 1 ? "persona" : "personas"}
                            </span>
                          )}
                        </TablaCelda>
                      </TablaFila>
                    );
                  })}
                </TablaCuerpo>
              </Tabla>
            </Tarjeta>
          )}

          <p className="mt-3 text-[11px] text-atenuado-contraste">
            El perfil de cada puesto es el formulario R-02-01: misión, funciones, formación y
            experiencia exigidas. La matriz de competencias y las capacitaciones están en
            Recursos humanos.
          </p>
        </PestanaContenido>
      </Pestanas>
    </>
  );
}
