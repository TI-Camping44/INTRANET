import type { Metadata } from "next";
import { LogIn } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ETIQUETAS_ROL } from "@/lib/constantes";
import { formatearFechaHora } from "@/lib/formato";
import type { RolUsuario } from "@/lib/tipos";

export const metadata: Metadata = { title: "Ingresos al sistema" };
export const dynamic = "force-dynamic";

/** Cuántos ingresos del historial se muestran. */
const ULTIMOS = 150;

interface FilaUsuario {
  id: string;
  nombre_completo: string;
  correo: string;
  rol: RolUsuario;
  activo: boolean;
  ultimo_ingreso: string | null;
}

interface FilaIngreso {
  id: string;
  ocurrido_en: string;
  agente: string | null;
  usuario: { nombre_completo: string; correo: string } | null;
}

/** De qué entró, en una palabra. El agente crudo no se lee. */
function describirAgente(agente: string | null): string {
  if (!agente) return "—";
  const texto = agente.toLowerCase();
  if (/(iphone|android|mobile)/.test(texto)) return "Celular";
  if (/ipad|tablet/.test(texto)) return "Tableta";
  return "Computadora";
}

/**
 * Quien entro al sistema y cuando.
 *
 * Son dos cosas distintas y por eso van en dos bloques:
 *
 *  · EL ESTADO DE CADA PERSONA, que sale de `usuarios.ultimo_ingreso` y
 *    se pisa en cada ingreso. Contesta «quien no entro todavia», que es
 *    la pregunta de la puesta en marcha.
 *  · EL HISTORIAL, que sale de `ingresos` y no se pisa nunca. Contesta
 *    «cuando entro Fulano en septiembre», que es la pregunta de una
 *    auditoria.
 *
 * El historial lo escribe un disparador sobre `auth.sessions`, no la
 * aplicacion: ningun camino de ingreso puede evadirlo. Por eso empieza
 * el dia que se creo la tabla y no antes —los ingresos anteriores no se
 * pueden reconstruir, Supabase purga su propio registro—, y la pantalla
 * lo dice en vez de aparentar que no hubo ninguno.
 */
export default async function PaginaAccesos() {
  await requerirRol(["administrador_sgc", "auditor", "direccion"]);
  const supabase = crearClienteServidor();

  const [{ data: usuarios }, { data: ingresos }] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, nombre_completo, correo, rol, activo, ultimo_ingreso")
      .order("ultimo_ingreso", { ascending: false, nullsFirst: false }),
    supabase
      .from("ingresos")
      .select("id, ocurrido_en, agente, usuario:usuario_id (nombre_completo, correo)")
      .order("ocurrido_en", { ascending: false })
      .limit(ULTIMOS),
  ]);

  const personas = (usuarios ?? []) as FilaUsuario[];
  const historial = (ingresos ?? []) as unknown as FilaIngreso[];

  const entraron = personas.filter((p) => p.ultimo_ingreso !== null);
  const haceUnaSemana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const activosSemana = personas.filter(
    (p) => p.ultimo_ingreso !== null && p.ultimo_ingreso >= haceUnaSemana,
  );

  return (
    <div className="mx-auto max-w-6xl">
      <EncabezadoPagina
        titulo="Ingresos al sistema"
        descripcion="Quién entró, cuándo fue la última vez y el historial completo. El historial lo escribe la base de datos, no la aplicación: ningún ingreso puede evadirlo."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Tarjeta className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
            Entraron alguna vez
          </p>
          <p className="mt-1.5 text-2xl font-semibold leading-none tabular">{entraron.length}</p>
          <p className="mt-3 text-[11px] text-atenuado-contraste">
            De {personas.length} perfiles creados
          </p>
        </Tarjeta>

        <Tarjeta className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
            Entraron esta semana
          </p>
          <p className="mt-1.5 text-2xl font-semibold leading-none tabular">
            {activosSemana.length}
          </p>
          <p className="mt-3 text-[11px] text-atenuado-contraste">En los últimos 7 días</p>
        </Tarjeta>

        <Tarjeta className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
            Ingresos registrados
          </p>
          <p className="mt-1.5 text-2xl font-semibold leading-none tabular">{historial.length}</p>
          <p className="mt-3 text-[11px] text-atenuado-contraste">
            {historial.length === ULTIMOS ? `Se muestran los últimos ${ULTIMOS}` : "Desde el inicio del registro"}
          </p>
        </Tarjeta>
      </div>

      {/* Bloque 1 · El estado de cada persona. */}
      <section className="mb-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-atenuado-contraste">
          Estado por persona
        </h2>

        <Tarjeta>
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado>Persona</TablaEncabezado>
                <TablaEncabezado>Rol</TablaEncabezado>
                <TablaEncabezado>Estado</TablaEncabezado>
                <TablaEncabezado>Último ingreso</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {personas.map((persona) => (
                <TablaFila key={persona.id}>
                  <TablaCelda className="text-xs">
                    <span className="block font-medium">{persona.nombre_completo}</span>
                    <span className="block text-[11px] text-atenuado-contraste">
                      {persona.correo}
                    </span>
                  </TablaCelda>
                  <TablaCelda className="whitespace-nowrap text-xs text-atenuado-contraste">
                    {ETIQUETAS_ROL[persona.rol]}
                  </TablaCelda>
                  <TablaCelda className="whitespace-nowrap text-xs">
                    {persona.activo ? (
                      <Insignia variante="contorno">Activo</Insignia>
                    ) : (
                      <Insignia variante="peligro">Inactivo</Insignia>
                    )}
                  </TablaCelda>
                  <TablaCelda className="whitespace-nowrap text-xs tabular">
                    {persona.ultimo_ingreso ? (
                      formatearFechaHora(persona.ultimo_ingreso)
                    ) : (
                      <span className="text-atenuado-contraste">Nunca entró</span>
                    )}
                  </TablaCelda>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </Tarjeta>
      </section>

      {/* Bloque 2 · El historial, que no se pisa. */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-atenuado-contraste">
          Historial de ingresos
        </h2>

        {historial.length === 0 ? (
          <EstadoVacio
            icono={<LogIn className="size-6" />}
            titulo="El registro todavía no tiene ingresos"
            descripcion="Empieza a anotar desde que se creó, el 9 de octubre de 2026. Los ingresos anteriores no se pueden reconstruir: Supabase purga su propio registro de accesos. El primero que entre a partir de ahora ya queda acá."
          />
        ) : (
          <Tarjeta>
            <Tabla>
              <TablaCabecera>
                <TablaFila>
                  <TablaEncabezado>Fecha y hora</TablaEncabezado>
                  <TablaEncabezado>Persona</TablaEncabezado>
                  <TablaEncabezado>Desde</TablaEncabezado>
                </TablaFila>
              </TablaCabecera>
              <TablaCuerpo>
                {historial.map((ingreso) => (
                  <TablaFila key={ingreso.id}>
                    <TablaCelda className="whitespace-nowrap text-xs tabular">
                      {formatearFechaHora(ingreso.ocurrido_en)}
                    </TablaCelda>
                    <TablaCelda className="text-xs">
                      <span className="block font-medium">
                        {ingreso.usuario?.nombre_completo ?? "—"}
                      </span>
                      <span className="block text-[11px] text-atenuado-contraste">
                        {ingreso.usuario?.correo ?? ""}
                      </span>
                    </TablaCelda>
                    <TablaCelda className="whitespace-nowrap text-xs text-atenuado-contraste">
                      {describirAgente(ingreso.agente)}
                    </TablaCelda>
                  </TablaFila>
                ))}
              </TablaCuerpo>
            </Tabla>
          </Tarjeta>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-atenuado-contraste">
          El historial lo escribe un disparador de la base de datos sobre la sesión, no la
          aplicación: ni la interfaz ni un script pueden evadirlo, y nadie puede borrar una fila.
          Para ver qué hizo cada persona una vez adentro, la{" "}
          <span className="font-medium">Bitácora</span> registra cada creación y cada cambio.
        </p>
      </section>
    </div>
  );
}
