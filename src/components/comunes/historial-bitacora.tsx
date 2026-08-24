import { History } from "lucide-react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFechaHora } from "@/lib/formato";
import { humanizar } from "@/lib/utilidades";
import type { RegistroBitacora } from "@/lib/tipos";

const ETIQUETAS_ACCION: Record<string, string> = {
  creacion: "Creación",
  edicion: "Edición",
  eliminacion: "Eliminación",
};

/**
 * Historial de trazabilidad de un registro. Se alimenta de la tabla
 * bitacora, escrita por disparadores en la base de datos. Es evidencia de
 * auditoria: quien hizo que, cuando, y con que valores.
 */
export async function HistorialBitacora({
  tablas,
  registroId,
  limite = 20,
}: {
  tablas: string[];
  registroId: string;
  limite?: number;
}) {
  const supabase = crearClienteServidor();

  const { data, error } = await supabase
    .from("bitacora")
    .select("*")
    .in("tabla", tablas)
    .eq("registro_id", registroId)
    .order("creado_en", { ascending: false })
    .limit(limite);

  const registros = (data as RegistroBitacora[] | null) ?? [];

  if (error) {
    return (
      <p className="text-xs text-atenuado-contraste">
        La bitácora solo es visible para Calidad, auditores y Dirección.
      </p>
    );
  }

  if (registros.length === 0) {
    return <p className="text-xs text-atenuado-contraste">Sin movimientos registrados.</p>;
  }

  return (
    <ol className="space-y-3">
      {registros.map((registro) => (
        <li key={registro.id} className="flex gap-3">
          <div className="mt-1 flex flex-col items-center">
            <span className="size-1.5 rounded-full bg-primario" />
            <span className="mt-1 w-px flex-1 bg-borde" />
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <p className="text-xs">
              <span className="font-medium">{ETIQUETAS_ACCION[registro.accion]}</span>
              {registro.usuario_correo ? (
                <span className="text-atenuado-contraste"> · {registro.usuario_correo}</span>
              ) : (
                <span className="text-atenuado-contraste"> · proceso automático</span>
              )}
            </p>
            <p className="text-[11px] text-atenuado-contraste">
              {formatearFechaHora(registro.creado_en)}
            </p>

            {registro.campos_modificados?.length ? (
              <ul className="mt-1.5 space-y-0.5">
                {registro.campos_modificados.slice(0, 6).map((campo) => (
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
                {registro.campos_modificados.length > 6 ? (
                  <li className="text-[11px] text-atenuado-contraste">
                    y {registro.campos_modificados.length - 6} campos más
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function formatearValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "vacío";
  if (typeof valor === "boolean") return valor ? "sí" : "no";
  const texto = String(valor);
  return texto.length > 60 ? `${texto.slice(0, 60)}…` : texto;
}

export function TituloHistorial() {
  return (
    <span className="flex items-center gap-2">
      <History className="size-4" /> Trazabilidad
    </span>
  );
}
