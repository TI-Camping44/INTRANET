"use client";

import * as React from "react";
import Link from "next/link";
import { Search, UserX } from "lucide-react";

import { Entrada } from "@/components/ui/campo";
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
import { BotonInvitar } from "@/app/(sgc)/administracion/usuarios/invitar";
import { SelectorPuesto } from "@/app/(sgc)/administracion/usuarios/selector-puesto";
import { SelectorLider } from "@/app/(sgc)/administracion/usuarios/selector-lider";
import { NombreDeEmpresa } from "@/components/comunes/marca-empresa";
import { ETIQUETAS_ROL } from "@/lib/constantes";
import { formatearFecha, formatearFechaHora } from "@/lib/formato";
import type { RolUsuario } from "@/lib/tipos";

/** Una persona de la lista, venga del padrón o de haber ingresado. */
export interface PersonaDeLaLista {
  clave: string;
  /** Para invitarla. Nulo si entró y no está en la exportación de Odoo. */
  nominaId: string | null;
  /** Para abrir su ficha. Nulo mientras no haya ingresado. */
  usuarioId: string | null;
  nombre: string;
  correo: string;
  cedula: string | null;
  puesto: string | null;
  puestoResuelve: boolean;
  /** El id del cargo cargado que le corresponde hoy, si hay. */
  puestoId: string | null;
  /** Lo que dice la exportación de Odoo, para poder compararlo. */
  puestoDeOdoo: string | null;
  /** Si alguien ya lo corrigió a mano. */
  puestoCorregido: boolean;
  empresa: string | null;
  /** El nombre de su líder, ya resuelto. Nulo si no cuelga de nadie. */
  lider: string | null;
  /** La clave de ese líder, para poder corregirlo desde la lista. */
  liderClave: string | null;
  /** Lo que dice la exportación de Odoo, para poder compararlo. */
  liderDeOdoo: string | null;
  /** Si alguien ya lo corrigió a mano. */
  liderCorregido: boolean;
  liderResuelve: boolean;
  rol: RolUsuario | null;
  activo: boolean;
  fechaIngreso: string | null;
  ultimoIngreso: string | null;
  invitadoEn: string | null;
  invitacionesEnviadas: number;
  enElPadron: boolean;
}

/** Para comparar sin que una tilde o una mayúscula separen. */
function normalizar(valor: string | null | undefined): string {
  return (valor ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * La lista de toda la gente, con buscador.
 *
 * SE BUSCA EN EL NAVEGADOR Y NO EN LA BASE. Son 55 personas: mandarlas a
 * consultar en cada tecla sería más lento que filtrarlas acá, y encima
 * dejaría la pantalla parpadeando. Con miles de filas la decisión sería
 * la otra, como en el buscador de clientes del reclamo.
 *
 * SE BUSCA POR NOMBRE, CORREO, CÉDULA, PUESTO Y ROL, y por partes:
 * «carlos calidad» encuentra a Carlos González. Buscar solo por nombre
 * obliga a saber de antemano a quién se busca, y la pregunta de todos los
 * días es la otra —quién tiene tal rol, quién ocupa tal puesto, de quién
 * es esta cédula—.
 */
export function ListaUsuarios({
  personas,
  puestos,
}: {
  personas: PersonaDeLaLista[];
  /** Los cargos cargados, para corregir el puesto desde la lista. */
  puestos: { id: string; nombre: string }[];
}) {
  const [busqueda, definirBusqueda] = React.useState("");
  const [soloPendientes, definirSoloPendientes] = React.useState(false);

  const filtradas = React.useMemo(() => {
    const partes = normalizar(busqueda).split(/\s+/).filter(Boolean);

    return personas.filter((persona) => {
      if (soloPendientes && persona.usuarioId !== null) return false;
      if (partes.length === 0) return true;

      const texto = normalizar(
        [
          persona.nombre,
          persona.correo,
          persona.cedula,
          persona.puesto,
          persona.empresa,
          persona.lider,
          persona.liderDeOdoo,
          persona.rol ? ETIQUETAS_ROL[persona.rol] : "pendiente",
          persona.usuarioId ? "ingreso" : "pendiente",
        ]
          .filter(Boolean)
          .join(" "),
      );
      return partes.every((parte) => texto.includes(parte));
    });
  }, [busqueda, personas, soloPendientes]);

  const pendientes = personas.filter((p) => p.usuarioId === null).length;

  // Los candidatos a líder son TODAS las personas, no las filtradas: el
  // buscador acota lo que se está mirando, no de quién puede colgar
  // alguien. Si no, buscar «bruno» dejaría elegible solo a Bruno.
  const candidatos = React.useMemo(
    () => personas.map((persona) => ({ clave: persona.clave, nombre: persona.nombre })),
    [personas],
  );

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-atenuado-contraste" />
          <Entrada
            value={busqueda}
            onChange={(evento) => definirBusqueda(evento.target.value)}
            placeholder="Buscar por nombre, correo, cédula, puesto o rol…"
            aria-label="Buscar persona"
            className="pl-9"
          />
        </div>

        {/* El filtro que de verdad se usa durante la puesta en marcha:
            a quién falta hacer entrar. */}
        <label className="flex items-center gap-1.5 whitespace-nowrap text-xs">
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(evento) => definirSoloPendientes(evento.target.checked)}
            className="size-3.5 accent-[hsl(var(--primario))]"
          />
          Solo los que faltan entrar ({pendientes})
        </label>
      </div>

      <Tarjeta>
        <Tabla>
          <TablaCabecera>
            <TablaFila>
              {/* EN EL CELULAR QUEDAN TRES COLUMNAS: quién es, cómo
                  está y el botón. Las otras cinco son contexto y en 360
                  píxeles empujaban el botón —que es a lo que se entra—
                  a mil cien píxeles de desplazamiento horizontal.
                  Siguen estando: aparecen al girar el teléfono y en
                  cualquier pantalla de escritorio. */}
              <TablaEncabezado>Persona</TablaEncabezado>
              <TablaEncabezado className="hidden lg:table-cell">
                Cédula
              </TablaEncabezado>
              <TablaEncabezado className="hidden md:table-cell">
                Puesto
              </TablaEncabezado>
              <TablaEncabezado className="hidden xl:table-cell">
                Empresa
              </TablaEncabezado>
              <TablaEncabezado className="hidden lg:table-cell">
                Líder inmediato
              </TablaEncabezado>
              <TablaEncabezado className="hidden xl:table-cell">
                Rol
              </TablaEncabezado>
              <TablaEncabezado>Estado</TablaEncabezado>
              <TablaEncabezado className="text-right">Acceso</TablaEncabezado>
            </TablaFila>
          </TablaCabecera>
          <TablaCuerpo>
            {filtradas.length === 0 ? (
              <TablaFila>
                <TablaCelda colSpan={8} className="py-8 text-center">
                  <UserX className="mx-auto mb-2 size-5 text-atenuado-contraste" />
                  <p className="text-xs text-atenuado-contraste">
                    {busqueda
                      ? `Nadie coincide con «${busqueda}».`
                      : "No queda nadie en este filtro."}
                  </p>
                </TablaCelda>
              </TablaFila>
            ) : (
              filtradas.map((persona) => {
                const entro = persona.usuarioId !== null;

                return (
                  <TablaFila key={persona.clave}>
                    {/* EL ANCHO SE ACOTA EN EL CELULAR. El correo y el
                        cargo son largos y sin tope estiraban la columna
                        hasta empujar el botón fuera de la pantalla. Con
                        tope, el nombre envuelve en dos líneas y entra
                        todo. En pantalla grande no hay tope. */}
                    <TablaCelda className="max-w-[10.5rem] text-xs sm:max-w-none">
                      {/* EL NOMBRE ABRE LA FICHA, cuando la hay. Mientras
                          la persona no ingresó no hay ficha que abrir, y
                          un enlace que lleva a una pantalla vacía es peor
                          que no tener enlace. */}
                      {entro ? (
                        <Link
                          href={`/administracion/usuarios/${persona.usuarioId}`}
                          className="block font-medium hover:underline"
                        >
                          {persona.nombre}
                        </Link>
                      ) : (
                        <span className="block font-medium">
                          {persona.nombre}
                        </span>
                      )}
                      <span className="block truncate text-[11px] text-atenuado-contraste">
                        {persona.correo}
                      </span>

                      {/* EL PUESTO VUELVE ACA EN EL CELULAR. Su columna
                          se esconde, pero el cargo es el dato que
                          identifica a la persona después del nombre:
                          esconderlo del todo sería perderlo, no
                          ordenarlo. Se corrige desde la columna, que
                          aparece en pantalla grande. */}
                      {persona.puesto ? (
                        <span className="block text-[11px] text-atenuado-contraste md:hidden">
                          {persona.puesto}
                        </span>
                      ) : null}
                      {!persona.enElPadron ? (
                        <Insignia variante="atencion" className="mt-1">
                          fuera del padrón
                        </Insignia>
                      ) : null}
                    </TablaCelda>

                    <TablaCelda className="hidden whitespace-nowrap text-xs tabular text-atenuado-contraste lg:table-cell">
                      {persona.cedula ?? "—"}
                    </TablaCelda>

                    {/* EL PUESTO SE CORRIGE ACA. Odoo tiene cargos
                        desactualizados y la pregunta «¿este es el que
                        ocupa hoy?» se hace mirando la lista entera, no
                        entrando de a una persona. */}
                    <TablaCelda className="hidden text-xs md:table-cell">
                      <SelectorPuesto
                        clave={persona.clave}
                        puestoActual={persona.puestoId}
                        puestoDeOdoo={persona.puestoDeOdoo}
                        corregido={persona.puestoCorregido}
                        puestos={puestos}
                      />
                    </TablaCelda>

                    <TablaCelda className="hidden whitespace-nowrap text-xs text-atenuado-contraste xl:table-cell">
                      <NombreDeEmpresa nombre={persona.empresa} />
                    </TablaCelda>

                    <TablaCelda className="hidden text-xs lg:table-cell">
                      <SelectorLider
                        clave={persona.clave}
                        liderClave={persona.liderClave}
                        liderNombre={persona.lider}
                        gerenteDeOdoo={persona.liderDeOdoo}
                        corregido={persona.liderCorregido}
                        enElPadron={persona.enElPadron}
                        candidatos={candidatos}
                      />
                    </TablaCelda>

                    <TablaCelda className="hidden whitespace-nowrap text-xs xl:table-cell">
                      {persona.rol ? (
                        ETIQUETAS_ROL[persona.rol]
                      ) : (
                        <span className="text-atenuado-contraste">—</span>
                      )}
                      {persona.rol && !persona.activo ? (
                        <Insignia variante="atencion" className="ml-1.5">
                          inactivo
                        </Insignia>
                      ) : null}
                    </TablaCelda>

                    <TablaCelda className="text-xs sm:whitespace-nowrap">
                      {entro ? (
                        <>
                          <Insignia variante="exito">Ingresó</Insignia>
                          {persona.ultimoIngreso ? (
                            <span className="ml-1.5 hidden text-[11px] text-atenuado-contraste sm:inline">
                              {formatearFechaHora(persona.ultimoIngreso)}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <Insignia variante="neutra">Pendiente</Insignia>
                          {/* CUÁNDO SE LE AVISÓ Y CUÁNTAS VECES. Con la
                              fecha sola no se ve a quién ya se le
                              insistió tres veces y sigue sin entrar, que
                              es la pregunta de la puesta en marcha. */}
                          {persona.invitadoEn ? (
                            <span className="ml-1.5 hidden text-[11px] text-atenuado-contraste sm:inline">
                              avisado {formatearFecha(persona.invitadoEn)}
                              {persona.invitacionesEnviadas > 1
                                ? ` · ${persona.invitacionesEnviadas} veces`
                                : null}
                            </span>
                          ) : null}
                        </>
                      )}
                    </TablaCelda>

                    <TablaCelda className="whitespace-nowrap text-right">
                      {entro ? (
                        <Link
                          href={`/administracion/usuarios/${persona.usuarioId}`}
                          className="text-[11px] underline underline-offset-2 hover:text-primario"
                        >
                          Ficha y permisos
                        </Link>
                      ) : persona.nominaId ? (
                        <BotonInvitar
                          personaId={persona.nominaId}
                          nombre={persona.nombre}
                          yaInvitada={persona.invitacionesEnviadas > 0}
                        />
                      ) : (
                        <span className="text-[11px] text-atenuado-contraste">
                          —
                        </span>
                      )}
                    </TablaCelda>
                  </TablaFila>
                );
              })
            )}
          </TablaCuerpo>
        </Tabla>
      </Tarjeta>

      <p className="mt-3 text-[11px] leading-relaxed text-atenuado-contraste">
        {busqueda || soloPendientes
          ? `${filtradas.length} de ${personas.length} personas.`
          : `${personas.length} personas.`}{" "}
        La lista sale de la exportación de Odoo.{" "}
        <strong>El puesto se corrige acá</strong>: toque el cargo y elija el que
        corresponde. La corrección queda en la intranet y la próxima carga del
        padrón no la pisa, así que no hace falta esperar a que Odoo se
        actualice. El rol, el líder y los permisos de quien ya ingresó se
        ajustan en su ficha.
      </p>
    </>
  );
}
