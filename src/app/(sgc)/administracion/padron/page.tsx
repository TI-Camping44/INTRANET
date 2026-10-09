import type { Metadata } from "next";
import { Users } from "lucide-react";
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
import { formatearFecha, formatearFechaHora } from "@/lib/formato";

export const metadata: Metadata = { title: "Padrón de la nómina" };
export const dynamic = "force-dynamic";

/** Para comparar nombres de puesto sin que una tilde los separe. */
function normalizar(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

interface FilaPadron {
  id: string;
  correo: string;
  nombre_completo: string;
  cedula: string | null;
  puesto_nombre: string | null;
  departamento: string | null;
  gerente_nombre: string | null;
  empresa_del_puesto: string | null;
  fecha_ingreso: string | null;
  usuario_id: string | null;
  usuario: { ultimo_ingreso: string | null; rol: string; activo: boolean } | null;
}

/**
 * El padron de la nomina: quien puede entrar y quien ya entro.
 *
 * EL PERFIL NO SE PUEDE PRECARGAR —`usuarios.id` depende de `auth.users`,
 * que nace en el primer ingreso con Google—, asi que la nomina vive
 * aparte y se vincula por correo cuando la persona entra. Esta pantalla
 * es la unica forma de ver ese padron: sin ella, 55 personas cargadas en
 * la base no se ven en ningun lado.
 *
 * Sirve para dos cosas distintas:
 *  · Seguir la puesta en marcha: cuantos de los 55 ya entraron.
 *  · Detectar ANTES de que entren a quien va a quedar mal: sin puesto
 *    equivalente, o con un lider que no figura en el padron.
 *
 * Es de solo lectura. El padron se vuelve a cargar desde la exportacion
 * de Odoo; corregirlo a mano aca seria perder el cambio en la proxima
 * carga.
 */
export default async function PaginaPadron() {
  await requerirRol(["administrador_sgc"]);
  const supabase = crearClienteServidor();

  const [{ data: padron }, { data: puestos }] = await Promise.all([
    supabase
      .from("personas_nomina")
      .select(
        "id, correo, nombre_completo, cedula, puesto_nombre, departamento, gerente_nombre," +
          " empresa_del_puesto, fecha_ingreso, usuario_id," +
          " usuario:usuario_id (ultimo_ingreso, rol, activo)",
      )
      .eq("activo", true)
      .order("nombre_completo"),
    supabase.from("puestos").select("nombre").eq("activo", true),
  ]);

  const filas = (padron ?? []) as unknown as FilaPadron[];

  // Que puestos existen, para avisar cual no va a poder asignarse.
  const puestosCargados = new Set(
    ((puestos ?? []) as { nombre: string }[]).map((p) => normalizar(p.nombre)),
  );

  // Quienes figuran en el padron, para avisar que lider no se va a poder
  // resolver: si el jefe no esta, nadie le va a escalar una accion.
  const nombresDelPadron = new Set(filas.map((f) => normalizar(f.nombre_completo)));

  const ingresaron = filas.filter((f) => f.usuario_id !== null);
  const sinPuesto = filas.filter(
    (f) => !f.puesto_nombre || !puestosCargados.has(normalizar(f.puesto_nombre)),
  );
  const sinLider = filas.filter(
    (f) => f.gerente_nombre && !nombresDelPadron.has(normalizar(f.gerente_nombre)),
  );

  return (
    <div className="mx-auto max-w-6xl">
      <EncabezadoPagina
        titulo="Padrón de la nómina"
        descripcion="Quiénes pueden entrar y quiénes ya entraron. Sale de la exportación de Odoo; el perfil se arma solo en el primer ingreso con Google."
      />

      {filas.length === 0 ? (
        <EstadoVacio
          icono={<Users className="size-6" />}
          titulo="El padrón está vacío"
          descripcion="Todavía no se cargó la nómina. Se carga desde la exportación de hr.employee de Odoo."
        />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tarjeta className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
                En el padrón
              </p>
              <p className="mt-1.5 text-2xl font-semibold leading-none tabular">{filas.length}</p>
              <p className="mt-3 text-[11px] text-atenuado-contraste">
                Personas con cuenta del Workspace
              </p>
            </Tarjeta>

            <Tarjeta className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
                Ya ingresaron
              </p>
              <p className="mt-1.5 text-2xl font-semibold leading-none tabular text-semaforo-bajo">
                {ingresaron.length}
              </p>
              <p className="mt-3 text-[11px] text-atenuado-contraste">
                Faltan {filas.length - ingresaron.length} de {filas.length}
              </p>
            </Tarjeta>

            <Tarjeta className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
                Sin puesto equivalente
              </p>
              <p
                className={`mt-1.5 text-2xl font-semibold leading-none tabular ${
                  sinPuesto.length > 0 ? "text-semaforo-alto" : ""
                }`}
              >
                {sinPuesto.length}
              </p>
              <p className="mt-3 text-[11px] text-atenuado-contraste">
                {sinPuesto.length === 0
                  ? "Todos resuelven contra un puesto cargado"
                  : "Van a entrar sin puesto asignado"}
              </p>
            </Tarjeta>

            <Tarjeta className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
                Con líder fuera del padrón
              </p>
              <p
                className={`mt-1.5 text-2xl font-semibold leading-none tabular ${
                  sinLider.length > 0 ? "text-semaforo-alto" : ""
                }`}
              >
                {sinLider.length}
              </p>
              <p className="mt-3 text-[11px] text-atenuado-contraste">
                {sinLider.length === 0
                  ? "La línea de reporte cierra completa"
                  : "No van a tener a quién escalar una acción"}
              </p>
            </Tarjeta>
          </div>

          <Tarjeta>
            <Tabla>
              <TablaCabecera>
                <TablaFila>
                  <TablaEncabezado>Persona</TablaEncabezado>
                  <TablaEncabezado>Cédula</TablaEncabezado>
                  <TablaEncabezado>Puesto</TablaEncabezado>
                  <TablaEncabezado>Empresa</TablaEncabezado>
                  <TablaEncabezado>Líder inmediato</TablaEncabezado>
                  <TablaEncabezado>Ingreso</TablaEncabezado>
                  <TablaEncabezado>Estado</TablaEncabezado>
                </TablaFila>
              </TablaCabecera>
              <TablaCuerpo>
                {filas.map((fila) => {
                  const puestoResuelve =
                    fila.puesto_nombre !== null &&
                    puestosCargados.has(normalizar(fila.puesto_nombre));
                  const liderResuelve =
                    fila.gerente_nombre !== null &&
                    nombresDelPadron.has(normalizar(fila.gerente_nombre));
                  const entro = fila.usuario_id !== null;

                  return (
                    <TablaFila key={fila.id}>
                      <TablaCelda className="text-xs">
                        <span className="block font-medium">{fila.nombre_completo}</span>
                        <span className="block text-[11px] text-atenuado-contraste">
                          {fila.correo}
                        </span>
                      </TablaCelda>

                      <TablaCelda className="whitespace-nowrap text-xs tabular text-atenuado-contraste">
                        {fila.cedula ?? "—"}
                      </TablaCelda>

                      <TablaCelda className="text-xs">
                        {fila.puesto_nombre ?? "—"}
                        {fila.puesto_nombre && !puestoResuelve ? (
                          <Insignia variante="atencion" className="ml-1.5">
                            sin equivalente
                          </Insignia>
                        ) : null}
                      </TablaCelda>

                      <TablaCelda className="whitespace-nowrap text-xs text-atenuado-contraste">
                        {fila.empresa_del_puesto ?? "—"}
                      </TablaCelda>

                      <TablaCelda className="text-xs">
                        {fila.gerente_nombre ?? (
                          <span className="text-atenuado-contraste">Sin líder declarado</span>
                        )}
                        {fila.gerente_nombre && !liderResuelve ? (
                          <Insignia variante="atencion" className="ml-1.5">
                            fuera del padrón
                          </Insignia>
                        ) : null}
                      </TablaCelda>

                      <TablaCelda className="whitespace-nowrap text-xs tabular text-atenuado-contraste">
                        {fila.fecha_ingreso ? formatearFecha(fila.fecha_ingreso) : "—"}
                      </TablaCelda>

                      <TablaCelda className="whitespace-nowrap text-xs">
                        {entro ? (
                          <>
                            <Insignia variante="exito">Ingresó</Insignia>
                            {fila.usuario?.ultimo_ingreso ? (
                              <span className="ml-1.5 text-[11px] text-atenuado-contraste">
                                {formatearFechaHora(fila.usuario.ultimo_ingreso)}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <Insignia variante="neutra">Pendiente</Insignia>
                        )}
                      </TablaCelda>
                    </TablaFila>
                  );
                })}
              </TablaCuerpo>
            </Tabla>
          </Tarjeta>

          <p className="mt-3 text-[11px] leading-relaxed text-atenuado-contraste">
            De solo lectura. El padrón se vuelve a cargar desde la exportación de Odoo, así que una
            corrección hecha acá se perdería en la próxima carga: se corrige en Odoo. El puesto y el
            rol de quien ya ingresó se ajustan en Usuarios y roles.
          </p>
        </>
      )}
    </div>
  );
}
