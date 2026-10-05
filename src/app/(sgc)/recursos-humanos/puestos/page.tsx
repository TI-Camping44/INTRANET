import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, UserPlus } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
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
}

/**
 * Perfil de Resultados de Puesto.
 *
 * El primero de los dos submódulos de Personas. Quedó reducido a lo que
 * Dirección pidió el 5 de octubre: los puestos con su departamento, el
 * perfil en PDF adjunto a cada uno, y quién está en cada puesto. La
 * matriz de competencias se retiró: Calidad definió el 5 de octubre que
 * no la van a usar.
 *
 * LOS CUATRO NÚMEROS DEL ENCABEZADO son la foto de la dotación:
 * cuántos puestos hay definidos, cuántos tienen a alguien, cuántos están
 * vacíos y cuánta gente entró al sistema y todavía no tiene puesto. El
 * último es el que se mueve solo: cada persona que ingresa por primera
 * vez y completa su perfil cae ahí hasta que Calidad le asigne el suyo.
 *
 * Un puesto está ocupado si hay al menos una persona activa en él. No se
 * cuenta "una persona por puesto": hay puestos con varios —los asesores
 * comerciales, los asistentes— y forzar la relación uno a uno haría
 * aparecer vacantes que no existen.
 */
export default async function PaginaPuestos() {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();
  const administra = esAdministrador(usuario);

  const [{ data: datosPuestos }, { data: datosPersonas }, { data: adjuntos }] = await Promise.all([
    supabase
      .from("puestos")
      .select("id, nombre, area, activo")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("usuarios")
      .select("id, nombre_completo, correo, puesto_id, url_avatar")
      .eq("activo", true)
      .order("nombre_completo"),
    supabase.from("adjuntos").select("entidad_id").eq("entidad", "puestos"),
  ]);

  const puestos = (datosPuestos as FilaPuesto[] | null) ?? [];
  const personas =
    (datosPersonas as
      | {
          id: string;
          nombre_completo: string;
          correo: string;
          puesto_id: string | null;
          url_avatar: string | null;
        }[]
      | null) ?? [];

  // Cuánta gente hay en cada puesto, y cuántos archivos tiene cada uno.
  const gentePorPuesto = new Map<string, number>();
  for (const persona of personas) {
    if (!persona.puesto_id) continue;
    gentePorPuesto.set(persona.puesto_id, (gentePorPuesto.get(persona.puesto_id) ?? 0) + 1);
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

  return (
    <>
      <EncabezadoPagina
        titulo="Perfil de Resultados de Puesto"
        descripcion="Los puestos de la empresa, su departamento y el perfil firmado de cada uno."
        acciones={administra ? <FormularioPuesto /> : null}
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
          accion={administra ? <FormularioPuesto /> : null}
        />
      ) : (
        <Tarjeta>
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado>Nombre del puesto</TablaEncabezado>
                <TablaEncabezado className="w-[16rem]">Departamento</TablaEncabezado>
                <TablaEncabezado className="w-[9rem] text-center">Personas</TablaEncabezado>
                <TablaEncabezado className="w-[9rem] text-center">Perfil</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {puestos.map((puesto) => {
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
