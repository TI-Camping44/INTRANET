"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { ErrorDeFormulario } from "@/components/ui/error-de-formulario";
import { AvisoDeCambiosSinGuardar } from "@/components/ui/aviso-cambios-sin-guardar";
import {
  guardarAccesosDelPuesto,
  validarAccesosDelPuesto,
} from "@/app/(sgc)/informatica/accesos/acciones";
import { ETIQUETAS_ROL } from "@/lib/constantes";
import {
  COLUMNAS_SENSIBLES,
  EMPRESAS_ODOO,
  ETIQUETAS_EMPRESA_ODOO,
  ETIQUETAS_NIVEL,
  MODULOS_ODOO,
  type ColumnaOdoo,
  type EmpresaOdoo,
  type NivelAcceso,
} from "@/lib/accesos";
import type { RolUsuario } from "@/lib/tipos";

export type AccesosIniciales = {
  google_workspace: boolean;
  intranet_rol: RolUsuario | null;
  odoo_empresas: EmpresaOdoo | null;
  otros_accesos: string | null;
  observaciones: string | null;
  estado: "propuesta" | "validada";
} & Record<ColumnaOdoo, NivelAcceso>;

/**
 * Los accesos de un puesto, sistema por sistema.
 *
 * Con «Sin usuario de Odoo» los módulos SE DESMONTAN, no se esconden:
 * un puesto sin usuario no tiene niveles que elegir, y dejarlos a la
 * vista invitaría a cargar algo que la base va a rechazar.
 */
export function FormularioAccesos({
  puestoId,
  inicial,
}: {
  puestoId: string;
  inicial: AccesosIniciales | null;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [validando, definirValidando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [empresa, definirEmpresa] = React.useState<string>(inicial?.odoo_empresas ?? "");

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);
    const resultado = await guardarAccesosDelPuesto(puestoId, new FormData(evento.currentTarget));
    definirEnviando(false);
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Accesos guardados.");
      router.refresh();
    } else {
      definirError(resultado.error);
      toast.error(resultado.error);
    }
  }

  async function validar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirValidando(true);
    const resultado = await validarAccesosDelPuesto(puestoId, new FormData(evento.currentTarget));
    definirValidando(false);
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Accesos validados.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={guardar}>
        <Tarjeta className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="google_workspace"
                  defaultChecked={inicial?.google_workspace ?? true}
                  className="size-4 accent-primario"
                />
                Cuenta de Google Workspace
              </label>
            </div>
            <GrupoCampo etiqueta="Rol en la Intranet" htmlFor="intranet_rol">
              <Seleccion id="intranet_rol" name="intranet_rol" defaultValue={inicial?.intranet_rol ?? "colaborador"}>
                <option value="">No entra a la Intranet</option>
                {(Object.keys(ETIQUETAS_ROL) as RolUsuario[]).map((rol) => (
                  <option key={rol} value={rol}>
                    {ETIQUETAS_ROL[rol]}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>
            <GrupoCampo etiqueta="Usuario de Odoo" htmlFor="odoo_empresas">
              <Seleccion
                id="odoo_empresas"
                name="odoo_empresas"
                value={empresa}
                onChange={(evento) => definirEmpresa(evento.target.value)}
              >
                <option value="">Sin usuario de Odoo</option>
                {EMPRESAS_ODOO.map((valor) => (
                  <option key={valor} value={valor}>
                    {ETIQUETAS_EMPRESA_ODOO[valor]}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>
          </div>

          {empresa ? (
            <fieldset>
              <legend className="mb-2 text-xs font-semibold">Módulos de Odoo</legend>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {MODULOS_ODOO.map((modulo) => (
                  <GrupoCampo
                    key={modulo.columna}
                    etiqueta={
                      COLUMNAS_SENSIBLES.includes(modulo.columna)
                        ? `${modulo.nombre} (sueldos y legajos)`
                        : modulo.nombre
                    }
                    htmlFor={modulo.columna}
                    ayuda={modulo.ayuda}
                  >
                    <Seleccion
                      id={modulo.columna}
                      name={modulo.columna}
                      defaultValue={inicial?.[modulo.columna] ?? "sin_acceso"}
                    >
                      {modulo.niveles.map((nivel) => (
                        <option key={nivel} value={nivel}>
                          {ETIQUETAS_NIVEL[nivel]}
                        </option>
                      ))}
                    </Seleccion>
                  </GrupoCampo>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <GrupoCampo
              etiqueta="Otros accesos"
              htmlFor="otros_accesos"
              ayuda="Planillas, tableros o carpetas compartidas que el puesto necesita."
            >
              <AreaTexto
                id="otros_accesos"
                name="otros_accesos"
                rows={3}
                defaultValue={inicial?.otros_accesos ?? ""}
                placeholder="Tablero de Logística, planilla de control de stock…"
              />
            </GrupoCampo>
            <GrupoCampo etiqueta="Observaciones" htmlFor="observaciones">
              <AreaTexto
                id="observaciones"
                name="observaciones"
                rows={3}
                defaultValue={inicial?.observaciones ?? ""}
                placeholder="Por qué el puesto necesita lo que tiene…"
              />
            </GrupoCampo>
          </div>

          <AvisoDeCambiosSinGuardar />
          {error ? <ErrorDeFormulario error={error} /> : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-atenuado-contraste">
              {inicial?.estado === "validada"
                ? "Guardar un cambio vuelve la fila a propuesta: hay que validarla de nuevo."
                : "Lo guardado queda como propuesta hasta que lo valide el jefe del área."}
            </p>
            <Boton type="submit" cargando={enviando}>
              Guardar accesos
            </Boton>
          </div>
        </Tarjeta>
      </form>

      {inicial && inicial.estado === "propuesta" ? (
        <form onSubmit={validar}>
          <Tarjeta className="space-y-3 p-5">
            <p className="text-xs font-semibold">Registrar la validación del jefe de área</p>
            <GrupoCampo
              etiqueta="Quién validó y cómo"
              htmlFor="quien_valido"
              requerido
              ayuda="Quede escrito para la auditoría: el nombre del jefe y el medio por el que confirmó."
            >
              <Entrada
                id="quien_valido"
                name="quien_valido"
                required
                minLength={5}
                placeholder="Bruno Penayo, por correo del 20/11/2026"
              />
            </GrupoCampo>
            <div className="flex justify-end">
              <Boton type="submit" variante="contorno" cargando={validando}>
                <CheckCircle2 aria-hidden /> Marcar como validada
              </Boton>
            </div>
          </Tarjeta>
        </form>
      ) : null}
    </div>
  );
}
