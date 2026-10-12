"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { requerirRol } from "@/lib/sesion";
import { esCanalDeVenta } from "@/lib/permisos-ventas";
import type { ResultadoAccion, RolUsuario } from "@/lib/tipos";

/**
 * Administracion de usuarios. Solo el Administrador SGC puede modificar
 * rol, superior y estado: la base de datos lo refuerza con un disparador,
 * de modo que nadie pueda elevarse el rol editando su propio perfil.
 */
export async function actualizarUsuario(
  id: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const administrador = await requerirRol(["administrador_sgc"]);
  const supabase = crearClienteServidor();

  const rol = String(datos.get("rol") ?? "colaborador") as RolUsuario;
  const superiorId = String(datos.get("superior_id") ?? "") || null;

  if (superiorId === id) {
    return { exito: false, error: "Una persona no puede ser su propio superior." };
  }

  // Evita el caso simple de jerarquía circular entre dos personas.
  if (superiorId) {
    const { data: superior } = await supabase
      .from("usuarios")
      .select("superior_id")
      .eq("id", superiorId)
      .maybeSingle();

    if (superior?.superior_id === id) {
      return {
        exito: false,
        error: "La jerarquía quedaría circular: esa persona ya reporta a este usuario.",
      };
    }
  }

  if (id === administrador.id && rol !== "administrador_sgc") {
    return {
      exito: false,
      error:
        "No puede quitarse a sí mismo el rol de Administrador SGC. Pídaselo a otro administrador.",
    };
  }

  const { error } = await supabase
    .from("usuarios")
    .update({
      rol,
      superior_id: superiorId,
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      puesto_id: String(datos.get("puesto_id") ?? "") || null,
      vendedor_planilla: String(datos.get("vendedor_planilla") ?? "").trim() || null,
      // Se filtra contra la lista antes de escribir. La base tiene su
      // propia restriccion, pero un canal mal escrito tiene que fallar
      // aca con un mensaje en castellano y no con un error de Postgres.
      ventas_canales: datos.getAll("ventas_canales").map(String).filter(esCanalDeVenta),
      activo: datos.get("activo") === "on",
    })
    .eq("id", id);

  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };

  revalidatePath("/administracion/usuarios");
  return { exito: true, mensaje: "Usuario actualizado." };
}

/** Edicion de los datos propios del perfil. */
export async function actualizarPerfilPropio(datos: FormData): Promise<ResultadoAccion> {
  const supabase = crearClienteServidor();

  const {
    data: { user: cuenta },
  } = await supabase.auth.getUser();

  if (!cuenta) return { exito: false, error: "No hay sesión activa." };

  const nombre = String(datos.get("nombre_completo") ?? "").trim();
  if (nombre.length < 3) {
    return { exito: false, error: "El nombre debe tener al menos 3 caracteres." };
  }

  const { error } = await supabase
    .from("usuarios")
    .update({
      nombre_completo: nombre,
      telefono: String(datos.get("telefono") ?? "").trim() || null,
    })
    .eq("id", cuenta.id);

  if (error) return { exito: false, error: `No se pudo actualizar el perfil: ${error.message}` };

  revalidatePath("/perfil");
  return { exito: true, mensaje: "Perfil actualizado." };
}

/**
 * Corrige el puesto de una persona, haya ingresado o no.
 *
 * ODOO TIENE CARGOS DESACTUALIZADOS: gente que cambió de puesto y nadie
 * lo actualizó en el ERP. La regla era «se corrige en Odoo y se vuelve a
 * cargar el padrón», y no sirve: el puesto correcto hace falta hoy y
 * actualizar Odoo no está en manos de Calidad.
 *
 * ESCRIBE EN DOS LUGARES SEGÚN EL CASO, y es a propósito:
 *
 *  · Quien ya ingresó tiene perfil, y su puesto vive en
 *    `usuarios.puesto_id`. La carga del padrón no lo toca.
 *  · Quien todavía no ingresó no tiene perfil —`usuarios.id` depende de
 *    `auth.users`—, así que la corrección va a `personas_nomina`, en una
 *    columna de ajuste a mano que la próxima carga del padrón tampoco
 *    pisa. `crear_perfil_usuario()` la traslada al perfil en el primer
 *    ingreso: sin eso la corrección se perdería justo el día en que la
 *    persona entra.
 *
 * Son dos lugares porque son dos cosas distintas, no dos copias de la
 * misma: un perfil que existe y una nómina que todavía no tiene perfil.
 * Quien usa la pantalla no ve la diferencia, que es el punto.
 *
 * RECIBE LA CLAVE, no el id: `usuario:<uuid>` o `nomina:<uuid>`, igual
 * que `mover_en_organigrama()`. Así la pantalla manda lo que tiene sin
 * tener que saber en cuál de las dos tablas cae cada fila.
 */
export async function definirPuesto(
  clave: string,
  puestoId: string | null,
): Promise<ResultadoAccion> {
  await requerirRol(["administrador_sgc"]);
  const supabase = crearClienteServidor();

  const [tipo, id] = clave.split(":");
  if ((tipo !== "usuario" && tipo !== "nomina") || !id) {
    return { exito: false, error: "No se reconoce a quién corresponde el cambio." };
  }

  if (tipo === "usuario") {
    const { error } = await supabase
      .from("usuarios")
      .update({ puesto_id: puestoId })
      .eq("id", id);

    if (error) {
      console.error("definirPuesto (usuario):", error.message);
      return { exito: false, error: "No se pudo guardar el puesto." };
    }
  } else {
    // La bandera va SIEMPRE en true, incluso al dejarlo sin puesto: eso
    // es una decisión —«no tiene cargo equivalente»— y tiene que poder
    // distinguirse de «todavía nadie lo miró».
    const { error } = await supabase
      .from("personas_nomina")
      .update({ puesto_manual_id: puestoId, puesto_manual_fijado: true })
      .eq("id", id);

    if (error) {
      console.error("definirPuesto (nomina):", error.message);
      return { exito: false, error: "No se pudo guardar el puesto." };
    }
  }

  revalidatePath("/administracion/usuarios");
  return { exito: true, mensaje: "Puesto actualizado." };
}
