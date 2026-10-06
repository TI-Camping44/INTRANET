"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { departe, notificar } from "@/lib/notificaciones";
import {
  CRITERIOS_EVALUACION,
  FACTOR_PUNTAJE,
  MESES_HASTA_REEVALUAR,
  resultadoSugerido,
} from "@/lib/proveedores";
import type { EstadoProveedor, ResultadoAccion } from "@/lib/tipos";

/**
 * Alta de un Asociado de Negocio.
 *
 * TODOS LOS CAMPOS SON OBLIGATORIOS menos el segundo contacto. Lo pidio
 * Direccion el 6 de octubre, y se controla aca: la validacion del
 * navegador es comodidad, no control.
 *
 * EL CODIGO NO SE ESCRIBE, SE GENERA. Nadie quiere inventarlo al dar de
 * alta, y a mano se repite o se saltea. La columna es obligatoria y
 * unica por empresa, asi que se calcula el siguiente `AN-xxx`. Los
 * importados de Sofidya conservan su `SOF-PR-...`, por eso el
 * correlativo mira solo los que empiezan con `AN-`.
 */
export async function crearProveedor(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite dar de alta Asociados de Negocio." };
  }

  const supabase = crearClienteServidor();

  const campos = leerCampos(datos);
  const problema = revisarCampos(campos);
  if (problema) return { exito: false, error: problema };

  const { data: existentes } = await supabase
    .from("proveedores")
    .select("codigo")
    .eq("empresa_id", usuario.empresa_id)
    .ilike("codigo", "AN-%");

  const secuencias = ((existentes as { codigo: string }[] | null) ?? [])
    .map((fila) => Number.parseInt(fila.codigo.split("-")[1] ?? "", 10))
    .filter((numero) => !Number.isNaN(numero));

  const codigo = `AN-${String((secuencias.length ? Math.max(...secuencias) : 0) + 1).padStart(3, "0")}`;

  const { data: proveedor, error } = await supabase
    .from("proveedores")
    .insert({
      empresa_id: usuario.empresa_id,
      codigo,
      ...campos,
      estado: "en_evaluacion",
    })
    .select("id, codigo")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        exito: false,
        error: "Dos altas al mismo tiempo tomaron el mismo código. Vuelva a intentar.",
      };
    }
    return { exito: false, error: `No se pudo crear el Asociado de Negocio: ${error.message}` };
  }

  revalidatePath("/proveedores");
  return {
    exito: true,
    id: proveedor.id,
    mensaje: `Asociado de Negocio ${proveedor.codigo} registrado.`,
  };
}

/** Los campos del formulario, ya limpios. */
function leerCampos(datos: FormData) {
  return {
    razon_social: String(datos.get("razon_social") ?? "").trim(),
    nombre_comercial: String(datos.get("nombre_comercial") ?? "").trim(),
    ruc: String(datos.get("ruc") ?? "").trim(),
    rubro: String(datos.get("rubro") ?? "").trim(),
    correo: String(datos.get("correo") ?? "").trim(),
    ciudad: String(datos.get("ciudad") ?? "").trim(),
    pais: String(datos.get("pais") ?? "").trim(),
    contacto: String(datos.get("contacto") ?? "").trim(),
    // EL UNICO OPCIONAL.
    contacto_secundario: String(datos.get("contacto_secundario") ?? "").trim() || null,
    periodicidad_evaluacion_meses: Number(datos.get("periodicidad_evaluacion_meses") ?? 12),
  };
}

/** Devuelve el mensaje del primer problema, o null si esta todo bien. */
function revisarCampos(campos: ReturnType<typeof leerCampos>): string | null {
  if (campos.razon_social.length < 3) {
    return "La razón social debe tener al menos 3 caracteres.";
  }
  if (!campos.nombre_comercial) return "Indique el nombre comercial.";
  if (!campos.ruc) return "Indique el RUC.";
  if (!campos.rubro) return "Indique el rubro.";
  if (!campos.contacto) return "Indique el primer contacto.";
  if (!campos.correo) return "Indique el correo.";
  if (!campos.ciudad) return "Indique la ciudad.";
  if (!campos.pais) return "Indique el país.";

  const periodicidad = campos.periodicidad_evaluacion_meses;
  if (!Number.isInteger(periodicidad) || periodicidad < 1 || periodicidad > 60) {
    return "La periodicidad de evaluación debe estar entre 1 y 60 meses.";
  }

  return null;
}

export async function actualizarProveedor(
  id: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite editar Asociados de Negocio." };
  }

  const campos = leerCampos(datos);
  const problema = revisarCampos(campos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();

  // El codigo no se edita: lo genero el alta y es lo que identifica al
  // Asociado de Negocio en el padron.
  const { error } = await supabase.from("proveedores").update(campos).eq("id", id);

  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };

  revalidatePath(`/proveedores/${id}`);
  return { exito: true, mensaje: "Asociado de Negocio actualizado." };
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
    return { exito: false, error: "Su rol no permite evaluar Asociados de Negocio." };
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

  // EL PERIODO EVALUADO, EN DOS FECHAS. La base no acepta un «hasta»
  // anterior al «desde», pero el mensaje de PostgreSQL no se entiende:
  // se controla aca para decirlo en castellano.
  const periodoDesde = String(datos.get("periodo_desde") ?? "");
  const periodoHasta = String(datos.get("periodo_hasta") ?? "");

  if (!periodoDesde || !periodoHasta) {
    return { exito: false, error: "Indique el período evaluado: desde y hasta." };
  }
  if (periodoHasta < periodoDesde) {
    return { exito: false, error: "El «hasta» del período no puede ser anterior al «desde»." };
  }

  const puntaje =
    Object.values(valores).reduce((suma, valor) => suma + valor, 0) * FACTOR_PUNTAJE;

  const resultado = (String(datos.get("resultado") ?? "") ||
    resultadoSugerido(puntaje)) as EstadoProveedor;

  const { error } = await supabase.from("proveedor_evaluaciones").insert({
    proveedor_id: proveedorId,
    fecha: String(datos.get("fecha") ?? new Date().toISOString().slice(0, 10)),
    periodo_desde: periodoDesde,
    periodo_hasta: periodoHasta,
    ...valores,
    resultado,
    comentario: String(datos.get("comentario") ?? "").trim() || null,
    evaluado_por: usuario.id,
  });

  if (error) return { exito: false, error: `No se pudo registrar la evaluación: ${error.message}` };

  // UN CONDICIONADO SE REEVALUA A LOS 3 MESES, que es lo que dice la
  // tabla de Calidad, y no segun la periodicidad del Asociado de
  // Negocio: la periodicidad es el ritmo normal y un condicionado no
  // esta en ritmo normal. El disparador de la base agenda la proxima con
  // la periodicidad, asi que se la ajusta antes.
  const mesesHasta = MESES_HASTA_REEVALUAR[resultado];
  if (mesesHasta) {
    await supabase
      .from("proveedores")
      .update({ periodicidad_evaluacion_meses: mesesHasta })
      .eq("id", proveedorId);
  }

  const { data: proveedor } = await supabase
    .from("proveedores")
    .select("codigo, razon_social, critico")
    .eq("id", proveedorId)
    .maybeSingle();

  // Un proveedor crítico que baja de aprobado merece aviso a Calidad.
  if (proveedor?.critico && resultado !== "aprobado" && resultado !== "aprobado_preferente") {
    const { data: administradores } = await supabase
      .from("usuarios")
      .select("id, correo")
      .eq("rol", "administrador_sgc")
      .eq("activo", true);

    for (const administrador of administradores ?? []) {
      await notificar(supabase, {
        deParteDe: departe(usuario),
        usuarioId: administrador.id,
        correoDestino: administrador.correo,
        tipo: "general",
        titulo: `Asociado de Negocio crítico ${resultado}: ${proveedor.codigo}`,
        mensaje:
          `${proveedor.razon_social} obtuvo ${puntaje} de 100 en su evaluación y quedó como ` +
          `${resultado}. Es un Asociado de Negocio marcado como crítico.`,
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
    return { exito: false, error: "Su rol no permite cambiar el estado del Asociado de Negocio." };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase.from("proveedores").update({ estado }).eq("id", id);
  if (error) return { exito: false, error: `No se pudo cambiar el estado: ${error.message}` };

  revalidatePath(`/proveedores/${id}`);
  revalidatePath("/proveedores");
  return { exito: true, mensaje: "Estado actualizado." };
}
