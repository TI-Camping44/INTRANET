"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { notificar } from "@/lib/notificaciones";
import { CRITERIOS_EVALUACION, FACTOR_PUNTAJE, resultadoSugerido } from "@/lib/proveedores";
import type { EstadoProveedor, ResultadoAccion } from "@/lib/tipos";

export async function crearProveedor(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite dar de alta proveedores." };
  }

  const supabase = crearClienteServidor();

  const codigo = String(datos.get("codigo") ?? "").trim().toUpperCase();
  const razonSocial = String(datos.get("razon_social") ?? "").trim();
  const periodicidad = Number(datos.get("periodicidad_evaluacion_meses") ?? 12);

  if (!codigo) return { exito: false, error: "Indique el código del proveedor." };
  if (razonSocial.length < 3) {
    return { exito: false, error: "La razón social debe tener al menos 3 caracteres." };
  }
  if (!Number.isInteger(periodicidad) || periodicidad < 1 || periodicidad > 60) {
    return { exito: false, error: "La periodicidad de evaluación debe estar entre 1 y 60 meses." };
  }

  const { data: proveedor, error } = await supabase
    .from("proveedores")
    .insert({
      empresa_id: usuario.empresa_id,
      codigo,
      razon_social: razonSocial,
      nombre_comercial: String(datos.get("nombre_comercial") ?? "").trim() || null,
      ruc: String(datos.get("ruc") ?? "").trim() || null,
      rubro: String(datos.get("rubro") ?? "").trim() || null,
      critico: datos.get("critico") === "on",
      correo: String(datos.get("correo") ?? "").trim() || null,
      telefono: String(datos.get("telefono") ?? "").trim() || null,
      ciudad: String(datos.get("ciudad") ?? "").trim() || null,
      pais: String(datos.get("pais") ?? "Paraguay").trim() || "Paraguay",
      contacto: String(datos.get("contacto") ?? "").trim() || null,
      periodicidad_evaluacion_meses: periodicidad,
      estado: "en_evaluacion",
      observaciones: String(datos.get("observaciones") ?? "").trim() || null,
    })
    .select("id, codigo")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { exito: false, error: `Ya existe un proveedor con el código ${codigo}.` };
    }
    return { exito: false, error: `No se pudo crear el proveedor: ${error.message}` };
  }

  revalidatePath("/proveedores");
  return { exito: true, id: proveedor.id, mensaje: `Proveedor ${proveedor.codigo} registrado.` };
}

export async function actualizarProveedor(
  id: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite editar proveedores." };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("proveedores")
    .update({
      razon_social: String(datos.get("razon_social") ?? "").trim(),
      nombre_comercial: String(datos.get("nombre_comercial") ?? "").trim() || null,
      ruc: String(datos.get("ruc") ?? "").trim() || null,
      rubro: String(datos.get("rubro") ?? "").trim() || null,
      critico: datos.get("critico") === "on",
      correo: String(datos.get("correo") ?? "").trim() || null,
      telefono: String(datos.get("telefono") ?? "").trim() || null,
      ciudad: String(datos.get("ciudad") ?? "").trim() || null,
      contacto: String(datos.get("contacto") ?? "").trim() || null,
      periodicidad_evaluacion_meses: Number(datos.get("periodicidad_evaluacion_meses") ?? 12),
      observaciones: String(datos.get("observaciones") ?? "").trim() || null,
    })
    .eq("id", id);

  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };

  revalidatePath(`/proveedores/${id}`);
  return { exito: true, mensaje: "Proveedor actualizado." };
}

/**
 * Registra una evaluacion periodica.
 *
 * El puntaje lo calcula la base de datos como columna generada, y el
 * disparador sincroniza la calificacion, el estado y la fecha de proxima
 * evaluacion del proveedor. Aqui solo se validan los criterios.
 */
export async function registrarEvaluacion(
  proveedorId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite evaluar proveedores." };
  }

  const supabase = crearClienteServidor();
  const valores: Record<string, number> = {};

  for (const criterio of CRITERIOS_EVALUACION) {
    const valor = Number(datos.get(criterio.campo));
    if (!Number.isInteger(valor) || valor < 1 || valor > 5) {
      return {
        exito: false,
        error: `Puntúe "${criterio.etiqueta}" con un valor entre 1 y 5.`,
      };
    }
    valores[criterio.campo] = valor;
  }

  const puntaje =
    Object.values(valores).reduce((suma, valor) => suma + valor, 0) * FACTOR_PUNTAJE;

  const resultado = (String(datos.get("resultado") ?? "") ||
    resultadoSugerido(puntaje)) as EstadoProveedor;

  const { error } = await supabase.from("proveedor_evaluaciones").insert({
    proveedor_id: proveedorId,
    fecha: String(datos.get("fecha") ?? new Date().toISOString().slice(0, 10)),
    periodo: String(datos.get("periodo") ?? "").trim() || null,
    ...valores,
    resultado,
    comentario: String(datos.get("comentario") ?? "").trim() || null,
    evaluado_por: usuario.id,
  });

  if (error) return { exito: false, error: `No se pudo registrar la evaluación: ${error.message}` };

  const { data: proveedor } = await supabase
    .from("proveedores")
    .select("codigo, razon_social, critico")
    .eq("id", proveedorId)
    .maybeSingle();

  // Un proveedor crítico que baja de aprobado merece aviso a Calidad.
  if (proveedor?.critico && resultado !== "aprobado") {
    const { data: administradores } = await supabase
      .from("usuarios")
      .select("id, correo")
      .eq("rol", "administrador_sgc")
      .eq("activo", true);

    for (const administrador of administradores ?? []) {
      await notificar(supabase, {
        usuarioId: administrador.id,
        correoDestino: administrador.correo,
        tipo: "general",
        titulo: `Proveedor crítico ${resultado}: ${proveedor.codigo}`,
        mensaje:
          `${proveedor.razon_social} obtuvo ${puntaje} de 100 en su evaluación y quedó como ` +
          `${resultado}. Es un proveedor marcado como crítico.`,
        enlace: `/proveedores/${proveedorId}`,
        entidad: "proveedores",
        entidadId: proveedorId,
        claveUnicidad: `proveedor-critico:${proveedorId}:${String(datos.get("fecha") ?? "")}`,
      });
    }
  }

  revalidatePath(`/proveedores/${proveedorId}`);
  revalidatePath("/proveedores");
  return {
    exito: true,
    mensaje: `Evaluación registrada: ${puntaje} de 100, resultado ${resultado}.`,
  };
}

export async function cambiarEstadoProveedor(
  id: string,
  estado: EstadoProveedor,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite cambiar el estado del proveedor." };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase.from("proveedores").update({ estado }).eq("id", id);
  if (error) return { exito: false, error: `No se pudo cambiar el estado: ${error.message}` };

  revalidatePath(`/proveedores/${id}`);
  revalidatePath("/proveedores");
  return { exito: true, mensaje: "Estado actualizado." };
}
