"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { obtenerPermisos, requerirUsuario } from "@/lib/sesion";
import { hoyEnAsuncion } from "@/lib/formato";
import { esCategoriaGasto, esMoneda, leerImporte } from "@/lib/gastos-ti";
import type { EmpresaDelGrupo } from "@/lib/empresas";
import type { ResultadoAccion } from "@/lib/tipos";

const RUTA = "/informatica/gastos";

async function exigirEdicion(): Promise<string | null> {
  const permisos = await obtenerPermisos();
  return permisos.informatica.editar ? null : "Su rol no permite registrar gastos de TI.";
}

function leerCampos(datos: FormData) {
  return {
    fecha: String(datos.get("fecha") ?? "").trim(),
    proveedor: String(datos.get("proveedor") ?? "").trim(),
    concepto: String(datos.get("concepto") ?? "").trim(),
    categoria: String(datos.get("categoria") ?? ""),
    monto: leerImporte(String(datos.get("monto") ?? "")),
    moneda: String(datos.get("moneda") ?? ""),
    // Vacío: compartido entre las dos empresas.
    empresa_imputada_id: String(datos.get("empresa_imputada_id") ?? "") || null,
    activo_id: String(datos.get("activo_id") ?? "") || null,
    comprobante: String(datos.get("comprobante") ?? "").trim() || null,
    enlace_comprobante: String(datos.get("enlace_comprobante") ?? "").trim() || null,
    medio_pago: String(datos.get("medio_pago") ?? "").trim() || null,
    observaciones: String(datos.get("observaciones") ?? "").trim() || null,
  };
}

async function revisarCampos(campos: ReturnType<typeof leerCampos>): Promise<string | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(campos.fecha)) return "Indique la fecha del gasto.";
  if (campos.fecha > hoyEnAsuncion()) {
    return "La fecha no puede ser posterior a hoy: se registra lo que ya se pagó o facturó.";
  }
  if (campos.proveedor.length < 2) return "Escriba el proveedor.";
  if (campos.concepto.length < 3) return "Escriba el concepto.";
  if (!esCategoriaGasto(campos.categoria)) return "Elija la categoría.";
  if (campos.monto === null || campos.monto <= 0) {
    return "Escriba el monto como número, por ejemplo 504,57 o 150.000.";
  }
  if (!esMoneda(campos.moneda)) return "Elija la moneda.";
  if (campos.enlace_comprobante && !/^https:\/\//.test(campos.enlace_comprobante)) {
    return "El enlace al comprobante tiene que empezar con https://.";
  }
  if (campos.empresa_imputada_id) {
    const supabase = crearClienteServidor();
    const { data } = await supabase.rpc("empresas_del_grupo");
    const empresas = (data as EmpresaDelGrupo[] | null) ?? [];
    if (!empresas.some((empresa) => empresa.id === campos.empresa_imputada_id)) {
      return "Elija una de las dos empresas del grupo, o «Compartido».";
    }
  }
  return null;
}

export async function crearGasto(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  const campos = leerCampos(datos);
  const problema = await revisarCampos(campos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();
  const { data, error } = await supabase
    .from("gastos_ti")
    .insert({ ...campos, empresa_id: usuario.empresa_id, creado_por: usuario.id })
    .select("id")
    .single();

  if (error || !data) {
    return { exito: false, error: "No se pudo guardar el gasto. Revise los datos e intente de nuevo." };
  }

  revalidatePath(RUTA);
  return { exito: true, mensaje: "Gasto registrado.", id: (data as { id: string }).id };
}

export async function actualizarGasto(id: string, datos: FormData): Promise<ResultadoAccion> {
  await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  const campos = leerCampos(datos);
  const problema = await revisarCampos(campos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();
  const { error } = await supabase.from("gastos_ti").update(campos).eq("id", id);
  if (error) return { exito: false, error: "No se pudo guardar el cambio. Intente de nuevo." };

  revalidatePath(RUTA);
  revalidatePath(`${RUTA}/${id}`);
  return { exito: true, mensaje: "Gasto actualizado." };
}

export async function eliminarGasto(id: string): Promise<ResultadoAccion> {
  await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  const supabase = crearClienteServidor();
  const { error } = await supabase.from("gastos_ti").delete().eq("id", id);
  if (error) return { exito: false, error: "No se pudo eliminar el gasto. Intente de nuevo." };

  revalidatePath(RUTA);
  return { exito: true, mensaje: "Gasto eliminado." };
}
