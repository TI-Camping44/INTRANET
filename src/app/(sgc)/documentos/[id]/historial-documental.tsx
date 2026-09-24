import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFechaHora } from "@/lib/formato";
import { humanizar } from "@/lib/utilidades";
import type { RegistroBitacora } from "@/lib/tipos";

/**
 * El hilo del documento: los hitos y los cambios que significan algo.
 *
 * Antes se mostraba la bitácora entera, y la bitácora registra cada
 * escritura: «Orden categoría: 20 → 10» es evidencia de auditoría
 * perfectamente válida y a la vez ruido inútil en la ficha. Se veían
 * seis líneas de reordenamientos y ninguna decía nada del documento.
 *
 * Ahora se muestran los hitos que pide la norma —creado, validado,
 * aprobado, obsoleto— y además las ediciones de los campos que una
 * persona reconoce: si a alguien le cambian el nombre a un documento,
 * eso tiene que estar en el hilo.
 *
 * La fuente sigue siendo la bitácora, que la escriben los disparadores y
 * no la aplicación, así que esto no debilita la trazabilidad: filtra lo
 * que se muestra, no lo que se guarda. Todo lo demás sigue en la tabla
 * para quien tenga que auditarlo.
 */
const ESTADOS_CON_HITO: Record<string, string> = {
  en_revision: "Enviado a validación",
  vigente: "Aprobado y publicado",
  obsoleto: "Marcado obsoleto",
};

/**
 * Los campos cuyo cambio se cuenta. El resto —la posición en la carpeta,
 * la marca de actualización, el número de versión que mueve el propio
 * sistema— son mecánica interna: verdadera, y sin interés para nadie.
 */
const CAMPOS_VISIBLES = [
  "titulo",
  "codigo",
  "tipo",
  "categoria",
  "proceso_id",
  "responsable_id",
  "periodicidad_revision_meses",
  "descripcion",
];

function formatearValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "vacío";
  const texto = String(valor);
  return texto.length > 50 ? `${texto.slice(0, 50)}…` : texto;
}

export async function HistorialDocumental({ documentoId }: { documentoId: string }) {
  const supabase = crearClienteServidor();

  const { data, error } = await supabase
    .from("bitacora")
    .select("*")
    .eq("tabla", "documentos")
    .eq("registro_id", documentoId)
    .order("creado_en", { ascending: false })
    .limit(60);

  if (error) {
    return (
      <p className="text-xs text-atenuado-contraste">
        La bitácora solo es visible para Calidad, auditores y Dirección.
      </p>
    );
  }

  const registros = (data as RegistroBitacora[] | null) ?? [];

  const hilo = registros
    .map((registro) => {
      if (registro.accion === "creacion") {
        return { registro, titulo: "Documento creado", cambios: [] as string[] };
      }

      const campos = registro.campos_modificados ?? [];

      // La validación se reconoce por su propia fecha y no por el
      // estado: validar no cambia el estado del documento.
      if (campos.includes("fecha_validacion") && registro.valores_nuevos?.fecha_validacion) {
        return { registro, titulo: "Validado", cambios: [] };
      }

      if (campos.includes("estado")) {
        const titulo = ESTADOS_CON_HITO[String(registro.valores_nuevos?.estado ?? "")];
        if (titulo) return { registro, titulo, cambios: [] };
      }

      const visibles = campos.filter((campo) => CAMPOS_VISIBLES.includes(campo));
      if (visibles.length > 0) {
        return { registro, titulo: "Documento editado", cambios: visibles };
      }

      return null;
    })
    .filter(Boolean) as { registro: RegistroBitacora; titulo: string; cambios: string[] }[];

  if (hilo.length === 0) {
    return (
      <p className="text-xs text-atenuado-contraste">
        Sin movimientos registrados todavía.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {hilo.map(({ registro, titulo, cambios }) => (
        <li key={registro.id} className="flex gap-3">
          <div className="mt-1 flex flex-col items-center">
            <span className="size-1.5 rounded-full bg-primario" />
            <span className="mt-1 w-px flex-1 bg-borde" />
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <p className="text-xs">
              <span className="font-medium">{titulo}</span>
              {registro.usuario_correo ? (
                <span className="text-atenuado-contraste"> · {registro.usuario_correo}</span>
              ) : (
                <span className="text-atenuado-contraste"> · proceso automático</span>
              )}
            </p>
            <p className="text-[11px] text-atenuado-contraste">
              {formatearFechaHora(registro.creado_en)}
            </p>

            {cambios.length > 0 ? (
              <ul className="mt-1 space-y-0.5">
                {cambios.map((campo) => (
                  <li key={campo} className="text-[11px] leading-relaxed">
                    <span className="text-atenuado-contraste">{humanizar(campo)}:</span>{" "}
                    <span className="line-through opacity-60">
                      {formatearValor(registro.valores_anteriores?.[campo])}
                    </span>{" "}
                    <span aria-hidden>→</span>{" "}
                    <span className="font-medium">
                      {formatearValor(registro.valores_nuevos?.[campo])}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
