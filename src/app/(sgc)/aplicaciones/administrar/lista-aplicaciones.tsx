"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LayoutGrid, Pencil, Plus, Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import {
  AreaTexto,
  Entrada,
  GrupoCampo,
  Seleccion,
} from "@/components/ui/campo";
import {
  Dialogo,
  DialogoCabecera,
  DialogoContenido,
  DialogoDescripcion,
  DialogoPie,
  DialogoTitulo,
} from "@/components/ui/dialogo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import {
  eliminarAplicacion,
  guardarAplicacion,
} from "@/app/(sgc)/aplicaciones/acciones";
import {
  estaOculta,
  ETIQUETAS_PUBLICO,
  LARGO_MAXIMO_DESCRIPCION_APLICACION,
  LARGO_MAXIMO_NOMBRE_APLICACION,
  ORDEN_PUBLICO,
  ROLES_DE_APLICACION,
  type Aplicacion,
  type EmpresaDelGrupo,
  type PersonaDeAplicacion,
} from "@/lib/aplicaciones";
import { MarcaVitalica } from "@/components/comunes/marca-empresa";
import { esDeVitalica } from "@/lib/empresas";
import { ETIQUETAS_ROL } from "@/lib/constantes";

/**
 * La lista de aplicaciones y su configuración.
 *
 * SE EDITA EN UN DIÁLOGO Y NO EN LA FILA. Son cuatro campos de texto y
 * cinco casillas: puestos en la fila, la tabla deja de poder leerse de
 * un vistazo, que es para lo que sirve. La misma razón por la que la
 * edición salió de la fila en la pantalla de Usuarios.
 *
 * UN FORMULARIO, NO DOS: el alta y la edición piden exactamente lo
 * mismo. Con uno propio para cada una, el de edición termina pidiendo
 * menos campos y guardar le borra a la fila lo que no le preguntó.
 */
export function ListaAplicaciones({
  aplicaciones,
  personas,
  empresas,
}: {
  aplicaciones: Aplicacion[];
  /** Quienes ya ingresaron: son los únicos que se pueden nombrar. */
  personas: PersonaDeAplicacion[];
  /** Las dos del grupo, como las devuelve `empresas_del_grupo()`. */
  empresas: EmpresaDelGrupo[];
}) {
  const router = useRouter();
  const [editando, definirEditando] = React.useState<Aplicacion | null>(null);
  const [abierto, definirAbierto] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);

  function abrirNueva() {
    definirEditando(null);
    definirAbierto(true);
  }

  function abrirEdicion(aplicacion: Aplicacion) {
    definirEditando(aplicacion);
    definirAbierto(true);
  }

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirProcesando(true);
    const resultado = await guardarAplicacion(
      new FormData(evento.currentTarget),
    );
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Listo.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function eliminar(aplicacion: Aplicacion) {
    const confirmado = confirm(
      `Se elimina «${aplicacion.nombre}» de la lista y se pierde su dirección.\n\n` +
        "Si lo que quiere es sacarla de la pantalla, destilde los roles en vez de eliminarla: " +
        "así la dirección queda guardada y se puede volver a mostrar cuando haga falta.",
    );
    if (!confirmado) return;

    const datos = new FormData();
    datos.set("id", aplicacion.id);

    definirProcesando(true);
    const resultado = await eliminarAplicacion(datos);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Aplicación eliminada.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Boton tamano="pequeno" onClick={abrirNueva}>
          <Plus /> Nueva aplicación
        </Boton>
      </div>

      {aplicaciones.length === 0 ? (
        <EstadoVacio
          icono={<LayoutGrid className="size-6" />}
          titulo="Sin aplicaciones cargadas"
          descripcion="Agregue la primera: un nombre, para qué sirve, la dirección y a qué roles se les muestra."
        />
      ) : (
        <Tabla>
          <TablaCabecera>
            <TablaFila>
              <TablaEncabezado>Aplicación</TablaEncabezado>
              <TablaEncabezado className="hidden w-[11rem] md:table-cell">
                Grupo
              </TablaEncabezado>
              <TablaEncabezado>Quién la ve</TablaEncabezado>
              <TablaEncabezado className="w-[5rem]" />
            </TablaFila>
          </TablaCabecera>
          <TablaCuerpo>
            {aplicaciones.map((aplicacion) => (
              <TablaFila key={aplicacion.id}>
                <TablaCelda className="text-xs">
                  <span className="font-medium">{aplicacion.nombre}</span>
                  {esDeVitalica(
                    empresas.find(
                      (e) => e.id === aplicacion.empresa_de_la_aplicacion_id,
                    )?.nombre,
                  ) ? (
                    <MarcaVitalica className="ml-1.5" />
                  ) : null}
                  {/* El grupo se esconde en el celular, pero no se
                      pierde: reaparece acá abajo. */}
                  <span className="block text-[10px] text-atenuado-contraste md:hidden">
                    {ETIQUETAS_PUBLICO[aplicacion.publico]}
                  </span>
                  <span className="block truncate text-[10px] text-atenuado-contraste">
                    {aplicacion.url}
                  </span>
                </TablaCelda>
                <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                  {ETIQUETAS_PUBLICO[aplicacion.publico]}
                </TablaCelda>
                <TablaCelda>
                  {estaOculta(aplicacion) ? (
                    <Insignia variante="contorno">
                      <span className="text-semaforo-medio">
                        Oculta para todos
                      </span>
                    </Insignia>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {aplicacion.roles_visibles.length ===
                      ROLES_DE_APLICACION.length ? (
                        <span className="text-xs text-atenuado-contraste">
                          Todos los roles
                        </span>
                      ) : (
                        ROLES_DE_APLICACION.filter((rol) =>
                          aplicacion.roles_visibles.includes(rol),
                        ).map((rol) => (
                          <Insignia key={rol} variante="contorno">
                            {ETIQUETAS_ROL[rol]}
                          </Insignia>
                        ))
                      )}
                      {/* Las personas nombradas van con su nombre y no
                          con un número: «y 2 personas más» obliga a
                          abrir la ficha para saber quiénes son. */}
                      {personas
                        .filter((persona) =>
                          aplicacion.usuarios_visibles.includes(persona.id),
                        )
                        .map((persona) => (
                          <Insignia key={persona.id} variante="contorno">
                            {persona.nombre_completo.split(" ")[0]}{" "}
                            {persona.nombre_completo.split(" ")[1] ?? ""}
                          </Insignia>
                        ))}
                    </span>
                  )}
                </TablaCelda>
                <TablaCelda className="text-right">
                  <Boton
                    variante="fantasma"
                    tamano="pequeno"
                    onClick={() => abrirEdicion(aplicacion)}
                  >
                    <Pencil /> Editar
                  </Boton>
                </TablaCelda>
              </TablaFila>
            ))}
          </TablaCuerpo>
        </Tabla>
      )}

      <Dialogo open={abierto} onOpenChange={definirAbierto}>
        <DialogoContenido className="max-w-xl">
          <DialogoCabecera>
            <DialogoTitulo>
              {editando ? "Editar aplicación" : "Nueva aplicación"}
            </DialogoTitulo>
            <DialogoDescripcion>
              La tarjeta abre en una pestaña nueva. Quien no tenga el rol
              marcado no recibe la aplicación desde la base: no la ve ni
              escribiendo la dirección de esta pantalla.
            </DialogoDescripcion>
          </DialogoCabecera>

          {/* La clave fuerza a React a rehacer el formulario al cambiar
              de aplicación: sin eso, los campos no controlados conservan
              lo que tenían de la fila anterior. */}
          <form
            key={editando?.id ?? "nueva"}
            onSubmit={guardar}
            className="space-y-3"
          >
            {editando ? (
              <input type="hidden" name="id" value={editando.id} />
            ) : null}

            <GrupoCampo etiqueta="Nombre" htmlFor="nombre" requerido>
              <Entrada
                id="nombre"
                name="nombre"
                required
                maxLength={LARGO_MAXIMO_NOMBRE_APLICACION}
                defaultValue={editando?.nombre ?? ""}
                placeholder="Catálogo de salón"
              />
            </GrupoCampo>

            <GrupoCampo
              etiqueta="Para qué sirve"
              htmlFor="descripcion"
              requerido
              ayuda="Es la línea que se lee abajo del nombre."
            >
              <AreaTexto
                id="descripcion"
                name="descripcion"
                required
                rows={2}
                maxLength={LARGO_MAXIMO_DESCRIPCION_APLICACION}
                defaultValue={editando?.descripcion ?? ""}
              />
            </GrupoCampo>

            <GrupoCampo
              etiqueta="Dirección"
              htmlFor="url"
              requerido
              ayuda="Tiene que empezar con https://"
            >
              <Entrada
                id="url"
                name="url"
                type="url"
                required
                pattern="https://.*"
                defaultValue={editando?.url ?? ""}
                placeholder="https://"
              />
            </GrupoCampo>

            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
              <GrupoCampo etiqueta="Grupo" htmlFor="publico" requerido>
                <Seleccion
                  id="publico"
                  name="publico"
                  required
                  defaultValue={editando?.publico ?? "solicitudes"}
                >
                  {ORDEN_PUBLICO.map((publico) => (
                    <option key={publico} value={publico}>
                      {ETIQUETAS_PUBLICO[publico]}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Orden"
                htmlFor="orden"
                ayuda="Menor, más arriba."
              >
                <Entrada
                  id="orden"
                  name="orden"
                  type="number"
                  step={1}
                  defaultValue={editando?.orden ?? 0}
                />
              </GrupoCampo>
            </div>

            {/* DE QUÉ EMPRESA ES. «Del grupo» es la opción por omisión y
                la de casi todas: marcarlas todas llenaría la pantalla de
                etiquetas que no distinguen nada. Lo que se marca como
                Vitalica lleva franja naranja y su nombre en la tarjeta,
                igual que en el organigrama. */}
            <GrupoCampo
              etiqueta="De qué empresa es"
              htmlFor="empresa"
              ayuda="Lo de Vitalica se muestra con su franja naranja. Déjelo en «Del grupo» si es de las dos."
            >
              <Seleccion
                id="empresa"
                name="empresa"
                defaultValue={editando?.empresa_de_la_aplicacion_id ?? ""}
              >
                <option value="">Del grupo</option>
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>
                    {empresa.nombre}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>

            <fieldset className="rounded-md border border-borde p-3">
              <legend className="px-1 text-xs font-medium">Quién la ve</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {ROLES_DE_APLICACION.map((rol) => (
                  <label key={rol} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      name="rol"
                      value={rol}
                      defaultChecked={
                        editando ? editando.roles_visibles.includes(rol) : true
                      }
                      className="size-3.5 accent-primario"
                    />
                    {ETIQUETAS_ROL[rol]}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-atenuado-contraste">
                El Administrador SGC ve todas y no se puede configurar: es lo
                que garantiza que siempre quede alguien capaz de volver a
                mostrar lo que se ocultó.
              </p>
            </fieldset>

            {/* LAS PERSONAS SE SUMAN A LOS ROLES, no los reemplazan: la
                tarjeta le llega a quien tenga uno de los roles marcados
                o a quien esté nombrado acá. Con los roles sin marcar y
                una sola persona, «la ve solo él» es literal. */}
            <fieldset className="rounded-md border border-borde p-3">
              <legend className="px-1 text-xs font-medium">
                Y además, estas personas
              </legend>
              {personas.length === 0 ? (
                <p className="text-xs text-atenuado-contraste">
                  Todavía no ingresó nadie al sistema, así que no hay a quién
                  nombrar.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto">
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {personas.map((persona) => (
                      <label
                        key={persona.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <input
                          type="checkbox"
                          name="persona"
                          value={persona.id}
                          defaultChecked={
                            editando
                              ? editando.usuarios_visibles.includes(persona.id)
                              : false
                          }
                          className="size-3.5 shrink-0 accent-primario"
                        />
                        <span className="truncate">
                          {persona.nombre_completo}
                          <span className="ml-1 text-[10px] text-atenuado-contraste">
                            {ETIQUETAS_ROL[persona.rol]}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <p className="mt-2 text-[10px] leading-relaxed text-atenuado-contraste">
                Se suman a los roles: la ve quien tenga uno de los roles
                marcados arriba <strong>o</strong> quien esté nombrado acá. Para
                que la vea una sola persona, no marque ningún rol y nómbrela.
                Solo figura quien ya ingresó al sistema: antes del primer
                ingreso con Google la persona no existe para la base. Sin roles
                ni personas, la aplicación deja de verse y su dirección queda
                guardada.
              </p>
            </fieldset>

            <DialogoPie className="flex-col gap-2 sm:flex-row sm:justify-between">
              {editando ? (
                <Boton
                  type="button"
                  variante="fantasma"
                  tamano="pequeno"
                  onClick={() => eliminar(editando)}
                >
                  <Trash2 /> Eliminar
                </Boton>
              ) : (
                <span />
              )}
              <span className="flex gap-2">
                <Boton
                  type="button"
                  variante="contorno"
                  onClick={() => definirAbierto(false)}
                >
                  Cancelar
                </Boton>
                <Boton type="submit" cargando={procesando}>
                  Guardar
                </Boton>
              </span>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </div>
  );
}
