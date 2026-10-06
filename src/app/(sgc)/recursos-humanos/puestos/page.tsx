import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, UserPlus } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import { esAdministrador, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { FormularioPuesto } from "@/app/(sgc)/recursos-humanos/puestos/formulario-puesto";
import { PersonasSinPuesto } from "@/app/(sgc)/recursos-humanos/puestos/personas-sin-puesto";

export const metadata: Metadata = { title: "Perfil de Resultados de Puesto" };
export const dynamic = "force-dynamic";

export interface FilaPuesto {
  id: string;
  nombre: string;
  area: string | null;
  activo: boolean;
  empresa_del_puesto_id: string | null;
}

/**
 * Perfil de Resultados de Puesto.
 *
 * El primero de los dos submódulos de Personas. Quedó reducido a lo que
 * Dirección pidió el 5 de octubre: los puestos con su departamento y su
 * empresa, el perfil en PDF adjunto a cada uno, y quién está en cada
 * puesto. La matriz de competencias se retiró: Calidad definió el 5 de
 * octubre que no la van a usar.
 *
 * LOS CUATRO NÚMEROS DEL ENCABEZADO son la foto de la dotación:
 * cuántos puestos hay definidos, cuántos tienen a alguien, cuántos están
 * vacíos y cuánta gente entró al sistema y todavía no tiene puesto. El
 * último es el que se mueve solo: cada persona que ingresa por primera
 * vez y completa su perfil cae ahí hasta que Calidad le asigne el suyo.
 *
 * Los números NO se recortan con los filtros: son la dotación completa.
 * Un encabezado que cambiara al filtrar por departamento diría «3 puestos
 * existentes» y sería falso.
 *
 * Un puesto está ocupado si hay al menos una persona activa en él, sea
 * como puesto principal o como segundo. No se cuenta "una persona por
 * puesto": hay puestos con varios —los asesores comerciales, los
 * asistentes— y forzar la relación uno a uno haría aparecer vacantes que
 * no existen.
 */
export default async function PaginaPuestos({
  searchParams,
}: {
  searchParams: { q?: string; puesto?: string; empresa?: string; area?: string };
}) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();
  const administra = esAdministrador(usuario);

  // Las empresas van por `empresas_del_grupo()` y no por un select a
  // `empresas`: esa tabla solo deja ver la propia, así que Vitalica no
  // aparecería en el selector. Es el mismo camino que usa el formulario
  // de no conformidad.
  const [{ data: datosPuestos }, { data: datosPersonas }, { data: adjuntos }, { data: datosEmpresas }] =
    await Promise.all([
      supabase
        .from("puestos")
        .select("id, nombre, area, activo, empresa_del_puesto_id")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("usuarios")
        .select("id, nombre_completo, correo, puesto_id, puesto_secundario_id, url_avatar")
        .eq("activo", true)
        .order("nombre_completo"),
      supabase.from("adjuntos").select("entidad_id").eq("entidad", "puestos"),
      supabase.rpc("empresas_del_grupo"),
    ]);

  const puestos = (datosPuestos as FilaPuesto[] | null) ?? [];
  const empresas = (datosEmpresas as { id: string; nombre: string }[] | null) ?? [];
  const personas =
    (datosPersonas as
      | {
          id: string;
          nombre_completo: string;
          correo: string;
          puesto_id: string | null;
          puesto_secundario_id: string | null;
          url_avatar: string | null;
        }[]
      | null) ?? [];

  const nombreDeEmpresa = new Map(empresas.map((empresa) => [empresa.id, empresa.nombre]));

  // Cuánta gente hay en cada puesto, contando los dos puestos que puede
  // ocupar cada persona, y cuántos archivos tiene cada uno.
  const gentePorPuesto = new Map<string, number>();
  for (const persona of personas) {
    for (const puestoId of [persona.puesto_id, persona.puesto_secundario_id]) {
      if (!puestoId) continue;
      gentePorPuesto.set(puestoId, (gentePorPuesto.get(puestoId) ?? 0) + 1);
    }
  }

  const archivosPorPuesto = new Map<string, number>();
  for (const adjunto of (adjuntos as { entidad_id: string }[] | null) ?? []) {
    archivosPorPuesto.set(
      adjunto.entidad_id,
      (archivosPorPuesto.get(adjunto.entidad_id) ?? 0) + 1,
    );
  }

  const ocupados = puestos.filter((puesto) => (gentePorPuesto.get(puesto.id) ?? 0) > 0).length;
  const sinPuesto = personas.filter((persona) => !persona.puesto_id);

  // Los departamentos del desplegable salen de los puestos cargados: una
  // lista fija se desactualizaría el día que Capital Humano cree uno.
  const departamentos = Array.from(
    new Set(puestos.map((puesto) => puesto.area).filter((area): area is string => Boolean(area))),
  ).sort((a, b) => a.localeCompare(b, "es"));

  const texto = (searchParams.q ?? "").trim().toLowerCase();
  const filtrados = puestos.filter((puesto) => {
    if (searchParams.puesto && puesto.id !== searchParams.puesto) return false;
    if (searchParams.empresa && puesto.empresa_del_puesto_id !== searchParams.empresa) return false;
    if (searchParams.area && (puesto.area ?? "") !== searchParams.area) return false;
    if (texto && !`${puesto.nombre} ${puesto.area ?? ""}`.toLowerCase().includes(texto)) {
      return false;
    }
    return true;
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Perfil de Resultados de Puesto"
        acciones={administra ? <FormularioPuesto empresas={empresas} /> : null}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador titulo="Puestos existentes" valor={puestos.length} />
        <TarjetaIndicador
          titulo="Puestos ocupados"
          valor={ocupados}
          contexto="Con al menos una persona"
        />
        <TarjetaIndicador
          titulo="Puestos vacantes"
          valor={puestos.length - ocupados}
          contexto="Definidos y sin nadie"
        />
        <TarjetaIndicador
          titulo="Personas sin puesto"
          valor={sinPuesto.length}
          contexto={sinPuesto.length > 0 ? "Esperan asignación" : "Todas asignadas"}
        />
      </div>

      {puestos.length === 0 ? (
        <EstadoVacio
          icono={<Briefcase className="size-6" />}
          titulo="Sin puestos definidos"
          descripcion="Cargue los puestos de la empresa. Cada uno lleva su perfil en PDF."
          accion={administra ? <FormularioPuesto empresas={empresas} /> : null}
        />
      ) : (
        <>
          <FiltrosListado
            marcadorBusqueda="Buscar por puesto o departamento…"
            campos={[
              {
                nombre: "puesto",
                etiqueta: "Puesto",
                opciones: puestos.map((puesto) => ({
                  valor: puesto.id,
                  etiqueta: puesto.nombre,
                })),
              },
              {
                nombre: "empresa",
                etiqueta: "Empresa",
                opciones: empresas.map((empresa) => ({
                  valor: empresa.id,
                  etiqueta: empresa.nombre,
                })),
              },
              {
                nombre: "area",
                etiqueta: "Departamento",
                opciones: departamentos.map((area) => ({ valor: area, etiqueta: area })),
              },
            ]}
          />

          {filtrados.length === 0 ? (
            <EstadoVacio
              icono={<Briefcase className="size-6" />}
              titulo="Ningún puesto coincide con los filtros"
              descripcion="Pruebe con otra empresa, otro departamento, o limpie los filtros."
            />
          ) : (
            <Tarjeta>
              <Tabla>
                <TablaCabecera>
                  <TablaFila>
                    <TablaEncabezado>Nombre del puesto</TablaEncabezado>
                    <TablaEncabezado className="w-[13rem]">Empresa</TablaEncabezado>
                    <TablaEncabezado className="w-[14rem]">Departamento</TablaEncabezado>
                    <TablaEncabezado className="w-[9rem] text-center">Personas</TablaEncabezado>
                    <TablaEncabezado className="w-[9rem] text-center">Perfil</TablaEncabezado>
                  </TablaFila>
                </TablaCabecera>
                <TablaCuerpo>
                  {filtrados.map((puesto) => {
                    const cuantos = gentePorPuesto.get(puesto.id) ?? 0;
                    const archivos = archivosPorPuesto.get(puesto.id) ?? 0;

                    return (
                      <TablaFila key={puesto.id}>
                        <TablaCelda className="text-xs font-medium">
                          <Link
                            href={`/recursos-humanos/puestos/${puesto.id}`}
                            className="hover:text-primario"
                          >
                            {puesto.nombre}
                          </Link>
                        </TablaCelda>
                        <TablaCelda className="text-xs text-atenuado-contraste">
                          {puesto.empresa_del_puesto_id
                            ? (nombreDeEmpresa.get(puesto.empresa_del_puesto_id) ?? "—")
                            : "—"}
                        </TablaCelda>
                        <TablaCelda className="text-xs text-atenuado-contraste">
                          {puesto.area ?? "—"}
                        </TablaCelda>
                        <TablaCelda className="text-center text-xs tabular">
                          {cuantos > 0 ? (
                            cuantos
                          ) : (
                            <span className="text-semaforo-medio">Vacante</span>
                          )}
                        </TablaCelda>
                        <TablaCelda className="text-center text-xs">
                          {archivos > 0 ? (
                            <span className="tabular text-atenuado-contraste">
                              {archivos} archivo{archivos === 1 ? "" : "s"}
                            </span>
                          ) : (
                            <span className="text-semaforo-alto">Sin perfil</span>
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
            {filtrados.length} de {puestos.length} puesto{puestos.length === 1 ? "" : "s"} en el
            listado. Una persona puede ocupar hasta dos puestos.
          </p>
        </>
      )}

      {/* Quien entró al sistema y todavía no tiene puesto. Se alimenta
          solo: cada persona que ingresa por primera vez carga su nombre y
          su cumpleaños, y cae acá hasta que Calidad le asigne el suyo. */}
      <Tarjeta className="mt-6">
        <TarjetaCabecera>
          <TarjetaTitulo>Personas sin puesto</TarjetaTitulo>
        </TarjetaCabecera>
        <TarjetaContenido>
          {sinPuesto.length === 0 ? (
            <p className="text-xs text-atenuado-contraste">
              Todas las personas que ingresaron tienen su puesto asignado.
            </p>
          ) : (
            <PersonasSinPuesto
              personas={sinPuesto}
              puestos={puestos}
              puedeAsignar={administra}
            />
          )}
        </TarjetaContenido>
      </Tarjeta>

      {sinPuesto.length > 0 && !administra ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-atenuado-contraste">
          <UserPlus className="size-3.5" />
          El puesto lo asigna el Administrador SGC.
        </p>
      ) : null}
    </>
  );
}
