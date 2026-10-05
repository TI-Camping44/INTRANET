"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Paperclip, Trash2, Upload, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campo";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import {
  adjuntarArchivoFormacion,
  eliminarArchivoFormacion,
  registrarAsistencia,
} from "@/app/(sgc)/recursos-humanos/formacion/acciones";
import { ACEPTA_EVIDENCIA, describirTamano } from "@/lib/adjuntos";
import { formatearFecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import type { EstadoCapacitacion } from "@/lib/tipos";

interface Convocado {
  id: string;
  usuario_id: string;
  asistio: boolean | null;
  eficacia: string | null;
  usuarios: { nombre_completo: string; correo: string } | null;
}

interface ArchivoDeFormacion {
  id: string;
  nombre_archivo: string;
  tamano_bytes: number;
  descripcion: string | null;
  creado_en: string;
}

/**
 * El registro de participación y las evidencias.
 *
 * SE ABRE CUANDO LA ACCIÓN QUEDA EJECUTADA, que es cuando hay algo que
 * registrar. Antes se ve la lista de convocados —hace falta: es a quién
 * hay que avisar— pero sin los controles de asistencia, porque marcar
 * que alguien asistió a algo que todavía no pasó no tiene sentido.
 *
 * Los archivos son el registro de participación firmado, los
 * certificados y cualquier otra evidencia de que la acción se llevó a
 * cabo. Sin ellos, en una auditoría, la formación no ocurrió.
 *
 * EL ENLACE NO SE DIBUJA EN LA PÁGINA. Cada archivo apunta a
 * `/adjuntos/<id>`, y esa ruta firma el enlace recién en el clic, por
 * cinco minutos y con la sesión de la persona.
 */
export function PanelEjecucion({
  formacionId,
  estado,
  requiereEficacia,
  participantes,
  archivos,
  puedeEditar,
}: {
  formacionId: string;
  estado: EstadoCapacitacion;
  requiereEficacia: boolean;
  participantes: Convocado[];
  archivos: ArchivoDeFormacion[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);
  const [marcando, definirMarcando] = React.useState<string | null>(null);

  const ejecutada = estado === "ejecutada";
  const asistieron = participantes.filter((convocado) => convocado.asistio === true).length;

  async function marcar(convocado: Convocado, asistio: boolean) {
    definirMarcando(convocado.id);
    const resultado = await registrarAsistencia(convocado.id, formacionId, asistio);
    definirMarcando(null);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Registrado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function subir(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    definirProcesando(true);
    const resultado = await adjuntarArchivoFormacion(formacionId, new FormData(formulario));
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Archivo subido.");
      formulario.reset();
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function quitar(archivo: ArchivoDeFormacion) {
    if (!confirm(`¿Quitar «${archivo.nombre_archivo}»? No se puede deshacer.`)) return;

    const resultado = await eliminarArchivoFormacion(archivo.id, formacionId);
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Archivo eliminado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <>
      <Tarjeta>
        <TarjetaCabecera>
          <TarjetaTitulo>
            {ejecutada ? "Registro de participación" : "Convocados"}
            {ejecutada ? ` · ${asistieron} de ${participantes.length}` : ""}
          </TarjetaTitulo>
        </TarjetaCabecera>
        <TarjetaContenido>
          {participantes.length === 0 ? (
            <p className="text-xs text-atenuado-contraste">
              Sin colaboradores convocados. Se agregan desde «Editar».
            </p>
          ) : (
            <ul className="divide-y divide-borde">
              {participantes.map((convocado) => (
                <li key={convocado.id} className="flex items-center gap-3 py-2 first:pt-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {convocado.usuarios?.nombre_completo ?? "Sin nombre"}
                    </span>
                    <span className="block truncate text-[11px] text-atenuado-contraste">
                      {convocado.usuarios?.correo}
                    </span>
                  </span>

                  {ejecutada && puedeEditar ? (
                    <span className="flex shrink-0 gap-1">
                      <Boton
                        tamano="iconoPequeno"
                        variante={convocado.asistio === true ? "primario" : "contorno"}
                        aria-label={`Marcar que ${convocado.usuarios?.nombre_completo} asistió`}
                        cargando={marcando === convocado.id}
                        onClick={() => marcar(convocado, true)}
                      >
                        <Check />
                      </Boton>
                      <Boton
                        tamano="iconoPequeno"
                        variante="contorno"
                        aria-label={`Marcar que ${convocado.usuarios?.nombre_completo} no asistió`}
                        cargando={marcando === convocado.id}
                        onClick={() => marcar(convocado, false)}
                        className={cn(
                          convocado.asistio === false &&
                            "border-semaforo-critico/50 text-semaforo-critico",
                        )}
                      >
                        <X />
                      </Boton>
                    </span>
                  ) : ejecutada ? (
                    <span className="shrink-0 text-[11px] text-atenuado-contraste">
                      {convocado.asistio === true
                        ? "Asistió"
                        : convocado.asistio === false
                          ? "No asistió"
                          : "Sin registrar"}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {!ejecutada ? (
            <p className="mt-3 rounded-md border border-dashed border-borde p-3 text-[11px] leading-relaxed text-atenuado-contraste">
              La asistencia se registra cuando la acción pase a «Ejecutada». Hasta entonces esta
              es la lista de a quiénes hay que convocar.
            </p>
          ) : requiereEficacia ? (
            <p className="mt-3 rounded-md border border-semaforo-medio/40 bg-semaforo-medio/10 p-3 text-[11px] leading-relaxed text-semaforo-medio">
              Esta formación supera las 2 horas: a los dos meses hay que evaluar su eficacia,
              persona por persona. El aviso lo manda el trabajo programado.
            </p>
          ) : null}
        </TarjetaContenido>
      </Tarjeta>

      <Tarjeta>
        <TarjetaCabecera>
          <TarjetaTitulo>
            {ejecutada ? "Evidencias y plan" : "Plan o programa"}
          </TarjetaTitulo>
        </TarjetaCabecera>
        <TarjetaContenido className="space-y-3">
          {archivos.length === 0 ? (
            <p className="text-xs leading-relaxed text-atenuado-contraste">
              {ejecutada
                ? "Suba el registro de participación firmado y los certificados: sin evidencia, en una auditoría la formación no ocurrió."
                : "Suba el plan o programa de la formación."}
            </p>
          ) : (
            <ul className="divide-y divide-borde">
              {archivos.map((archivo) => (
                <li key={archivo.id} className="flex items-start gap-2 py-2 first:pt-0">
                  {/* El enlace firmado se genera en el clic, en /adjuntos/[id]. */}
                  <a
                    href={`/adjuntos/${archivo.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-start gap-2 hover:underline"
                  >
                    <Paperclip className="mt-0.5 size-3.5 shrink-0 text-atenuado-contraste" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">
                        {archivo.nombre_archivo}
                      </span>
                      <span className="block text-[11px] text-atenuado-contraste">
                        {describirTamano(archivo.tamano_bytes)} ·{" "}
                        {formatearFecha(archivo.creado_en)}
                        {archivo.descripcion ? ` · ${archivo.descripcion}` : ""}
                      </span>
                    </span>
                  </a>

                  {puedeEditar ? (
                    <Boton
                      tamano="iconoPequeno"
                      variante="fantasma"
                      aria-label={`Quitar ${archivo.nombre_archivo}`}
                      onClick={() => quitar(archivo)}
                      className="text-atenuado-contraste hover:text-semaforo-critico"
                    >
                      <Trash2 />
                    </Boton>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {puedeEditar ? (
            <form
              onSubmit={subir}
              className="space-y-2 rounded-md border border-dashed border-borde p-3"
            >
              <input
                type="file"
                name="archivo"
                multiple
                required
                accept={ACEPTA_EVIDENCIA}
                className="block w-full text-xs file:mr-2 file:rounded file:border file:border-borde file:bg-acento file:px-2 file:py-1 file:text-xs"
              />
              <Entrada
                name="descripcion"
                placeholder={
                  ejecutada ? "Registro de participación, certificado…" : "Plan o programa"
                }
                className="text-xs"
              />
              <div className="flex justify-end">
                <Boton type="submit" tamano="pequeno" cargando={procesando}>
                  <Upload /> Subir
                </Boton>
              </div>
            </form>
          ) : null}
        </TarjetaContenido>
      </Tarjeta>
    </>
  );
}
