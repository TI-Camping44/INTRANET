"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { requerirUsuarioSinPerfil } from "@/lib/sesion";
import { hoyEnAsuncion } from "@/lib/formato";
import type { ResultadoAccion } from "@/lib/tipos";

/**
 * El perfil que cada persona completa la primera vez que entra.
 *
 * ESCRIBE SOLO SOBRE LA PROPIA FILA: el `eq("id", usuario.id)` no es una
 * comodidad, es el control. Y RLS lo sostiene igual del otro lado: nadie
 * puede escribir el legajo de otro desde acá.
 *
 * No toca el rol, el puesto ni el superior. Eso lo asigna el
 * Administrador SGC: una persona no se adjudica su propio puesto.
 */
export async function guardarPerfilInicial(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuarioSinPerfil();

  const nombres = String(datos.get("nombres") ?? "").trim();
  const apellidos = String(datos.get("apellidos") ?? "").trim();
  const fechaNacimiento = String(datos.get("fecha_nacimiento") ?? "").trim();

  if (nombres.length < 2) return { exito: false, error: "Escriba su nombre." };
  if (apellidos.length < 2) return { exito: false, error: "Escriba su apellido." };
  if (!fechaNacimiento) return { exito: false, error: "Elija su fecha de nacimiento." };

  // Una fecha futura o de hace más de 100 años es un error de tipeo, no
  // un dato. Se corta acá porque después alimenta los cumpleaños del mes
  // y un año mal puesto se arrastra sin que nadie lo note.
  const hoy = hoyEnAsuncion();
  if (fechaNacimiento >= hoy) {
    return { exito: false, error: "La fecha de nacimiento tiene que ser anterior a hoy." };
  }
  if (Number(hoy.slice(0, 4)) - Number(fechaNacimiento.slice(0, 4)) > 100) {
    return { exito: false, error: "Revise el año de nacimiento." };
  }

  const supabase = crearClienteServidor();

  // `nombre_completo` no se escribe acá: lo arma el disparador
  // `usuarios_armar_nombre` a partir de los dos campos, para que no
  // puedan contradecirse.
  const { data: actualizado, error } = await supabase
    .from("usuarios")
    .update({ nombres, apellidos, fecha_nacimiento: fechaNacimiento })
    .eq("id", usuario.id)
    .select("id")
    .maybeSingle();

  if (error) return { exito: false, error: `No se pudo guardar: ${error.message}` };
  if (!actualizado) {
    return { exito: false, error: "No se pudo guardar el perfil. Vuelva a intentar." };
  }

  revalidatePath("/inicio");
  revalidatePath("/recursos-humanos");
  return { exito: true, mensaje: "Perfil completado." };
}
