"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { departe, notificar } from "@/lib/notificaciones";
import { ESTADOS_OBJETIVO, type EstadoObjetivo } from "@/lib/objetivos";
import type { FrecuenciaMedicion, ResultadoAccion, SentidoIndicador } from "@/lib/tipos";

const FORMATO_CODIGO = /^[A-Z]{2,6}-[0-9]{2,3}$/;

/** Alta de un indicador de desempeno. */
export async function crearIndicador(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite crear indicadores." };
  }

  const supabase = crearClienteServidor();

  const codigo = String(datos.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(datos.get("nombre") ?? "").trim();
  const sentido = String(datos.get("sentido") ?? "mayor_mejor") as SentidoIndicador;
  const meta = datos.get("meta") ? Number(datos.get("meta")) : null;
  const metaMinima = datos.get("meta_minima") ? Number(datos.get("meta_minima")) : null;
  const metaMaxima = datos.get("meta_maxima") ? Number(datos.get("meta_maxima")) : null;

  if (!FORMATO_CODIGO.test(codigo)) {
    return { exito: false, error: "El código debe tener la forma KPI-01." };
  }
  if (nombre.length < 5) {
    return { exito: false, error: "El nombre debe tener al menos 5 caracteres." };
  }
  if (sentido === "rango") {
    if (metaMinima === null || metaMaxima === null) {
      return {
        exito: false,
        error: "Un indicador por rango necesita su valor mínimo y su valor máximo.",
      };
    }
    if (metaMinima >= metaMaxima) {
      return { exito: false, error: "El mínimo del rango debe ser menor que el máximo." };
    }
  } else if (meta === null || Number.isNaN(meta)) {
    return { exito: false, error: "Indique la meta del indicador." };
  }

  const { data: indicador, error } = await supabase
    .from("indicadores")
    .insert({
      empresa_id: usuario.empresa_id,
      codigo,
      nombre,
      descripcion: String(datos.get("descripcion") ?? "").trim() || null,
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      responsable_id: String(datos.get("responsable_id") ?? "") || usuario.id,
      formula: String(datos.get("formula") ?? "").trim() || null,
      unidad: String(datos.get("unidad") ?? "%").trim() || "%",
      frecuencia: String(datos.get("frecuencia") ?? "mensual") as FrecuenciaMedicion,
      // Las columnas del F-EST-01-05. `objetivo_id` es lo que en la hoja
      // pone al indicador y a su objetivo en la misma fila.
      objetivo_id: String(datos.get("objetivo_id") ?? "") || null,
      linea_base: datos.get("linea_base") ? Number(datos.get("linea_base")) : null,
      fuente_dato: String(datos.get("fuente_dato") ?? "").trim() || null,
      consolidacion: String(datos.get("consolidacion") ?? "promedio"),
      sentido,
      meta,
      meta_minima: metaMinima,
      meta_maxima: metaMaxima,
      activo: true,
    })
    .select("id, codigo")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { exito: false, error: `Ya existe un indicador con el código ${codigo}.` };
    }
    return { exito: false, error: `No se pudo crear el indicador: ${error.message}` };
  }

  revalidatePath("/indicadores");
  return { exito: true, id: indicador.id, mensaje: `Indicador ${indicador.codigo} creado.` };
}

export async function actualizarIndicador(
  id: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite editar indicadores." };
  }

  const supabase = crearClienteServidor();

  const nombre = String(datos.get("nombre") ?? "").trim();
  const sentido = String(datos.get("sentido") ?? "mayor_mejor") as SentidoIndicador;
  const meta = datos.get("meta") ? Number(datos.get("meta")) : null;
  const metaMinima = datos.get("meta_minima") ? Number(datos.get("meta_minima")) : null;
  const metaMaxima = datos.get("meta_maxima") ? Number(datos.get("meta_maxima")) : null;

  // LAS MISMAS VALIDACIONES QUE EL ALTA. Esta accion existia desde el
  // principio pero ninguna pantalla la llamaba, asi que nunca se habia
  // notado que dejaba guardar un indicador por rango sin rango, o con el
  // minimo por encima del maximo.
  if (nombre.length < 5) {
    return { exito: false, error: "El nombre debe tener al menos 5 caracteres." };
  }
  if (sentido === "rango") {
    if (metaMinima === null || metaMaxima === null) {
      return {
        exito: false,
        error: "Un indicador por rango necesita su valor mínimo y su valor máximo.",
      };
    }
    if (metaMinima >= metaMaxima) {
      return { exito: false, error: "El mínimo del rango debe ser menor que el máximo." };
    }
  } else if (meta === null || Number.isNaN(meta)) {
    return { exito: false, error: "Indique la meta del indicador." };
  }

  // EL CODIGO NO SE EDITA. Es lo que identifica al indicador en la hoja
  // de Calidad y en los informes ya emitidos; cambiarlo rompe la
  // referencia sin que nadie se entere.
  const { data: actualizado, error } = await supabase
    .from("indicadores")
    .update({
      nombre,
      descripcion: String(datos.get("descripcion") ?? "").trim() || null,
      formula: String(datos.get("formula") ?? "").trim() || null,
      unidad: String(datos.get("unidad") ?? "%").trim() || "%",
      frecuencia: String(datos.get("frecuencia") ?? "mensual") as FrecuenciaMedicion,
      sentido,
      meta,
      meta_minima: metaMinima,
      meta_maxima: metaMaxima,
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      responsable_id: String(datos.get("responsable_id") ?? "") || null,
      objetivo_id: String(datos.get("objetivo_id") ?? "") || null,
      linea_base: datos.get("linea_base") ? Number(datos.get("linea_base")) : null,
      fuente_dato: String(datos.get("fuente_dato") ?? "").trim() || null,
      consolidacion: String(datos.get("consolidacion") ?? "promedio"),
    })
    .eq("id", id)
    .select("codigo")
    .maybeSingle();

  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };
  if (!actualizado) {
    return { exito: false, error: "El indicador no existe o no tiene acceso." };
  }

  revalidatePath(`/indicadores/${id}`);
  revalidatePath("/indicadores");
  return {
    exito: true,
    mensaje: `Indicador ${(actualizado as { codigo: string }).codigo} actualizado.`,
  };
}

/**
 * Baja de un indicador.
 *
 * SE BORRAN TAMBIEN SUS MEDICIONES, y por eso se avisa cuantas son antes
 * de que la persona confirme: un indicador con dos años de mediciones
 * cargadas es historia del SGC, no un registro suelto. El aviso va en la
 * pantalla; aca se borra lo que corresponde.
 *
 * Las mediciones primero: si se borrara el indicador y despues fallara
 * el borrado de las mediciones, quedarian filas apuntando a un indicador
 * que ya no existe.
 */
export async function eliminarIndicador(id: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite eliminar indicadores." };
  }

  const supabase = crearClienteServidor();

  const { data: indicador } = await supabase
    .from("indicadores")
    .select("codigo")
    .eq("id", id)
    .maybeSingle();

  if (!indicador) return { exito: false, error: "El indicador no existe o no tiene acceso." };

  const { error: errorMediciones } = await supabase
    .from("indicador_mediciones")
    .delete()
    .eq("indicador_id", id);

  if (errorMediciones) {
    return {
      exito: false,
      error: `No se pudieron eliminar las mediciones: ${errorMediciones.message}`,
    };
  }

  const { error } = await supabase.from("indicadores").delete().eq("id", id);
  if (error) return { exito: false, error: `No se pudo eliminar el indicador: ${error.message}` };

  revalidatePath("/indicadores");
  return {
    exito: true,
    mensaje: `Indicador ${(indicador as { codigo: string }).codigo} eliminado.`,
  };
}

/**
 * Carga o corrige la medicion de un periodo.
 *
 * El periodo se guarda como el primer dia del mes: asi dos cargas del
 * mismo mes son el mismo registro y la restriccion de unicidad de la base
 * evita duplicados aunque se cargue dos veces.
 */
export async function cargarMedicion(
  indicadorId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const periodoCrudo = String(datos.get("periodo") ?? "");
  const valorCrudo = String(datos.get("valor_real") ?? "");

  if (!periodoCrudo) return { exito: false, error: "Indique el período medido." };
  if (valorCrudo.trim() === "") return { exito: false, error: "Indique el valor medido." };

  const valor = Number(valorCrudo);
  if (Number.isNaN(valor)) return { exito: false, error: "El valor medido debe ser un número." };

  // "2026-08" o "2026-08-14" quedan anclados al primer día del mes.
  const periodo = `${periodoCrudo.slice(0, 7)}-01`;

  const { data: indicador } = await supabase
    .from("indicadores")
    .select("id, codigo, nombre, meta, unidad, sentido, meta_minima, meta_maxima, responsable_id")
    .eq("id", indicadorId)
    .maybeSingle();

  if (!indicador) return { exito: false, error: "El indicador no existe." };

  const metaPeriodo = datos.get("meta_periodo")
    ? Number(datos.get("meta_periodo"))
    : indicador.meta;

  const { error } = await supabase.from("indicador_mediciones").upsert(
    {
      indicador_id: indicadorId,
      periodo,
      valor_real: valor,
      meta_periodo: metaPeriodo,
      observacion: String(datos.get("observacion") ?? "").trim() || null,
      cargado_por: usuario.id,
    },
    { onConflict: "indicador_id,periodo" },
  );

  if (error) return { exito: false, error: `No se pudo cargar la medición: ${error.message}` };

  // Si la medición queda fuera de meta, se avisa al responsable.
  const cumple = evaluarCumplimiento(valor, metaPeriodo, indicador);

  if (cumple === false && indicador.responsable_id && indicador.responsable_id !== usuario.id) {
    const { data: responsable } = await supabase
      .from("usuarios")
      .select("id, correo")
      .eq("id", indicador.responsable_id)
      .maybeSingle();

    if (responsable) {
      await notificar(supabase, {
        deParteDe: departe(usuario),
        usuarioId: responsable.id,
        correoDestino: responsable.correo,
        tipo: "indicador_fuera_de_meta",
        titulo: `Indicador fuera de meta: ${indicador.codigo}`,
        mensaje:
          `"${indicador.nombre}" midió ${valor} ${indicador.unidad} en el período ${periodo.slice(0, 7)}, ` +
          `contra una meta de ${metaPeriodo} ${indicador.unidad}.`,
        enlace: `/indicadores/${indicadorId}`,
        entidad: "indicadores",
        entidadId: indicadorId,
        claveUnicidad: `kpi-fuera-meta:${indicadorId}:${periodo}`,
      });
    }
  }

  revalidatePath(`/indicadores/${indicadorId}`);
  revalidatePath("/indicadores");
  return { exito: true, mensaje: `Medición de ${periodo.slice(0, 7)} registrada.` };
}

/** Misma regla que la vista vista_indicadores_looker en la base de datos. */
function evaluarCumplimiento(
  valor: number,
  meta: number | null,
  indicador: { sentido: string; meta_minima: number | null; meta_maxima: number | null },
): boolean | null {
  if (indicador.sentido === "rango") {
    if (indicador.meta_minima === null || indicador.meta_maxima === null) return null;
    return valor >= indicador.meta_minima && valor <= indicador.meta_maxima;
  }
  if (meta === null) return null;
  return indicador.sentido === "mayor_mejor" ? valor >= meta : valor <= meta;
}

export async function eliminarMedicion(
  medicionId: string,
  indicadorId: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite eliminar mediciones." };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase.from("indicador_mediciones").delete().eq("id", medicionId);
  if (error) return { exito: false, error: `No se pudo eliminar: ${error.message}` };

  revalidatePath(`/indicadores/${indicadorId}`);
  return { exito: true, mensaje: "Medición eliminada." };
}

// ---------------------------------------------------------------------
// Objetivos de calidad
// ---------------------------------------------------------------------

export async function crearObjetivo(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite crear objetivos." };
  }

  const supabase = crearClienteServidor();

  const campos = leerCamposDelObjetivo(datos);
  const problema = revisarObjetivo(campos);
  if (problema) return { exito: false, error: problema };

  // EL CODIGO NO SE ESCRIBE, SE GENERA. Nadie quiere inventarlo al dar
  // de alta, y a mano se repite o se saltea. El indice unico de la base
  // decide; si dos altas coinciden, el mensaje lo dice.
  const { data: existentes } = await supabase
    .from("objetivos")
    .select("codigo")
    .eq("empresa_id", usuario.empresa_id)
    .ilike("codigo", "OBJ-%");

  const secuencias = ((existentes as { codigo: string }[] | null) ?? [])
    .map((fila) => Number.parseInt(fila.codigo.split("-")[1] ?? "", 10))
    .filter((numero) => !Number.isNaN(numero));

  const codigo = `OBJ-${String((secuencias.length ? Math.max(...secuencias) : 0) + 1).padStart(3, "0")}`;

  const { data: objetivo, error } = await supabase
    .from("objetivos")
    .insert({
      empresa_id: usuario.empresa_id,
      codigo,
      // El año sale de la fecha de inicio: es dato derivado y pedirlo
      // aparte era una forma de que no coincidieran.
      anio: Number(campos.fecha_inicio_medicion.slice(0, 4)),
      avance_porcentaje: 0,
      estado: "identificado",
      ...campos,
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
    return { exito: false, error: `No se pudo crear el objetivo: ${error.message}` };
  }

  revalidatePath("/indicadores");
  return {
    exito: true,
    id: objetivo.id,
    mensaje: `Objetivo ${objetivo.codigo} creado.`,
  };
}

/** Los campos del objetivo que pidió Dirección, ya limpios. */
function leerCamposDelObjetivo(datos: FormData) {
  const tipo = String(datos.get("tipo_resultado") ?? "");
  const esperadoSiNo = String(datos.get("resultado_esperado_si_no") ?? "");
  const numero = (campo: string) => {
    const crudo = String(datos.get(campo) ?? "").trim();
    return crudo === "" ? null : Number(crudo);
  };

  return {
    nombre: String(datos.get("nombre") ?? "").trim(),
    empresa_objetivo_id: String(datos.get("empresa_objetivo_id") ?? "") || null,
    fecha_inicio_medicion: String(datos.get("fecha_inicio_medicion") ?? ""),
    fecha_fin_medicion: String(datos.get("fecha_fin_medicion") ?? ""),
    tipo_resultado: tipo || null,
    // Solo se guarda lo que corresponde al tipo elegido. Si no, un
    // objetivo numerico se llevaria el texto que alguien tipeo antes de
    // cambiar de opinion.
    resultado_esperado_si_no: tipo === "si_no" ? esperadoSiNo === "si" : null,
    resultado_esperado_texto:
      tipo === "texto" ? String(datos.get("resultado_esperado_texto") ?? "").trim() || null : null,
    valor_minimo: tipo === "numerico" ? numero("valor_minimo") : null,
    valor_maximo: tipo === "numerico" ? numero("valor_maximo") : null,
    unidad_valor:
      tipo === "numerico" ? String(datos.get("unidad_valor") ?? "").trim() || null : null,
    frecuencia_medicion: String(datos.get("frecuencia_medicion") ?? "") || null,
    responsable_id: String(datos.get("responsable_id") ?? "") || null,
    fuente_datos: String(datos.get("fuente_datos") ?? "").trim() || null,
    recursos_requeridos: String(datos.get("recursos_requeridos") ?? "").trim() || null,
    proveedor_recursos: String(datos.get("proveedor_recursos") ?? "").trim() || null,
  };
}

/** El mensaje del primer problema, o null si está todo bien. */
function revisarObjetivo(campos: ReturnType<typeof leerCamposDelObjetivo>): string | null {
  if (campos.nombre.length < 5) {
    return "La denominación del objetivo debe tener al menos 5 caracteres.";
  }
  if (!campos.empresa_objetivo_id) return "Indique a qué empresa del grupo corresponde.";
  if (!campos.fecha_inicio_medicion) return "Indique la fecha de inicio de la medición.";
  if (!campos.fecha_fin_medicion) return "Indique la fecha de fin de la medición.";
  if (campos.fecha_fin_medicion < campos.fecha_inicio_medicion) {
    return "La fecha de fin no puede ser anterior a la de inicio.";
  }
  if (!campos.tipo_resultado) return "Indique el tipo de objetivo.";

  if (campos.tipo_resultado === "texto" && !campos.resultado_esperado_texto) {
    return "Escriba el resultado esperado.";
  }
  if (campos.tipo_resultado === "numerico") {
    if (campos.valor_minimo === null || campos.valor_maximo === null) {
      return "Indique los dos valores esperables, el mínimo y el máximo.";
    }
    if (!campos.unidad_valor) {
      return "Indique el nombre de la unidad del valor, por ejemplo «%».";
    }
  }
  if (
    campos.valor_minimo !== null &&
    campos.valor_maximo !== null &&
    campos.valor_maximo < campos.valor_minimo
  ) {
    return "El valor máximo no puede ser menor que el mínimo.";
  }

  if (!campos.frecuencia_medicion) return "Indique la frecuencia de medición.";
  if (!campos.responsable_id) return "Indique el responsable del objetivo.";

  // TODO OBLIGATORIO, desde el 8 de octubre. Un objetivo a medio
  // declarar no se puede medir ni llevar a la Revision por la Direccion.
  if (!campos.fuente_datos) return "Indique la fuente de datos.";
  if (!campos.recursos_requeridos) return "Indique los recursos requeridos.";
  if (!campos.proveedor_recursos) return "Indique quién provee los recursos.";

  return null;
}

/**
 * Edicion de un objetivo de la calidad.
 *
 * EL AÑO NO SE EDITA. Es el de la LINEA BASE del objetivo, no el de la
 * medicion, y es lo que `obtenerHoja` usa para decidir que objetivos
 * mostrar: moverlo haria aparecer y desaparecer objetivos de la hoja de
 * un año para otro sin que nadie lo hubiera pedido. Un objetivo de otro
 * año es otro objetivo.
 *
 * El codigo tampoco: identifica al objetivo en la hoja de Calidad y en
 * los informes ya emitidos.
 */
export async function actualizarObjetivo(
  objetivoId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite editar objetivos." };
  }

  // LAS MISMAS REGLAS QUE EL ALTA, porque es el mismo formulario. Antes
  // esta accion escribia cinco campos de los catorce que el alta pide:
  // alcanzaba para la pantalla de edicion que existia entonces, que
  // tambien pedia cinco. Con el formulario completo, guardar con las
  // reglas viejas le borraba al objetivo todo lo demas.
  const campos = leerCamposDelObjetivo(datos);
  const problema = revisarObjetivo(campos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();

  const { data: actualizado, error } = await supabase
    .from("objetivos")
    // Sin `codigo` y sin `anio`: los dos quedan como nacieron, por lo
    // que explica el comentario de arriba.
    .update(campos)
    .eq("id", objetivoId)
    .select("codigo")
    .maybeSingle();

  if (error) return { exito: false, error: `No se pudo guardar: ${error.message}` };
  if (!actualizado) return { exito: false, error: "El objetivo no existe o no tiene acceso." };

  revalidatePath("/indicadores");
  revalidatePath("/indicadores/plan");
  revalidatePath(`/indicadores/objetivos/${objetivoId}`);
  return {
    exito: true,
    mensaje: `Objetivo ${(actualizado as { codigo: string }).codigo} actualizado.`,
  };
}

/**
 * Baja de un objetivo.
 *
 * NO SE BORRA UN OBJETIVO CON INDICADORES COLGANDO. Los indicadores
 * quedarian sin objetivo y la hoja F-EST-01-05 —que es una fila por
 * objetivo con sus indicadores al lado— mostraria mediciones que no
 * miden nada. Primero se los reasigna o se los elimina.
 *
 * Lo mismo con su plan de acciones, el 6.2.2: son las acciones
 * comprometidas para alcanzarlo, y sin el objetivo pierden el sentido.
 * Ahi si se borran con el, porque no existen fuera de el.
 */
export async function eliminarObjetivo(objetivoId: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite eliminar objetivos." };
  }

  const supabase = crearClienteServidor();

  const { data: objetivo } = await supabase
    .from("objetivos")
    .select("codigo")
    .eq("id", objetivoId)
    .maybeSingle();

  if (!objetivo) return { exito: false, error: "El objetivo no existe o no tiene acceso." };

  const { count } = await supabase
    .from("indicadores")
    .select("id", { count: "exact", head: true })
    .eq("objetivo_id", objetivoId);

  if ((count ?? 0) > 0) {
    return {
      exito: false,
      error:
        `No se puede eliminar: hay ${count} indicador(es) colgando de este objetivo. ` +
        "Reasígnelos o elimínelos primero.",
    };
  }

  // El plan de acciones del objetivo se va con él: no existe sin él.
  const { error: errorPlan } = await supabase
    .from("objetivo_planes")
    .delete()
    .eq("objetivo_id", objetivoId);

  if (errorPlan) {
    return { exito: false, error: `No se pudo eliminar el plan: ${errorPlan.message}` };
  }

  const { error } = await supabase.from("objetivos").delete().eq("id", objetivoId);
  if (error) return { exito: false, error: `No se pudo eliminar el objetivo: ${error.message}` };

  revalidatePath("/indicadores");
  revalidatePath("/indicadores/plan");
  return {
    exito: true,
    mensaje: `Objetivo ${(objetivo as { codigo: string }).codigo} eliminado.`,
  };
}

export async function actualizarAvanceObjetivo(
  objetivoId: string,
  avance: number,
  estado: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite actualizar objetivos." };
  }

  if (!Number.isFinite(avance) || avance < 0 || avance > 100) {
    return { exito: false, error: "El avance debe estar entre 0 y 100." };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("objetivos")
    .update({ avance_porcentaje: avance, estado })
    .eq("id", objetivoId);

  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };

  revalidatePath("/indicadores");
  return { exito: true, mensaje: "Avance del objetivo actualizado." };
}

/**
 * Cambia el estado del objetivo desde su ficha.
 *
 * CERRAR EXIGE DECLARAR EL RESULTADO. Un objetivo cerrado sin decir si
 * se alcanzo o no es un registro que no dice nada, y la Revision por la
 * Direccion se apoya justamente en eso. Lo controla ademas el `CHECK`
 * `objetivos_cierre_declarado` de la base: la pantalla puede fallar, la
 * restriccion no.
 *
 * Al reabrir un objetivo cerrado se limpian el resultado y el
 * comentario: dejarlos seria afirmar un cierre que ya no existe.
 */
export async function cambiarEstadoObjetivo(
  objetivoId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite cambiar el estado de un objetivo." };
  }

  const estado = String(datos.get("estado") ?? "");
  if (!ESTADOS_OBJETIVO.includes(estado as EstadoObjetivo)) {
    return { exito: false, error: "Elija un estado válido." };
  }

  const cierra = estado === "cerrado";
  const alcanzado = String(datos.get("objetivo_alcanzado") ?? "");

  if (cierra && alcanzado !== "si" && alcanzado !== "no") {
    return { exito: false, error: "Al cerrar, indique si el objetivo se alcanzó o no." };
  }

  const supabase = crearClienteServidor();

  const { data: objetivo, error } = await supabase
    .from("objetivos")
    .update({
      estado,
      objetivo_alcanzado: cierra ? alcanzado === "si" : null,
      comentario_cierre: cierra
        ? String(datos.get("comentario_cierre") ?? "").trim() || null
        : null,
    })
    .eq("id", objetivoId)
    .select("codigo")
    .maybeSingle();

  if (error) return { exito: false, error: `No se pudo cambiar el estado: ${error.message}` };
  if (!objetivo) {
    return { exito: false, error: "El objetivo no existe o su rol no puede editarlo." };
  }

  revalidatePath("/indicadores");
  revalidatePath(`/indicadores/objetivos/${objetivoId}`);
  return {
    exito: true,
    mensaje: cierra
      ? `${(objetivo as { codigo: string }).codigo} cerrado.`
      : "Estado actualizado.",
  };
}

// ---------------------------------------------------------------------
// El resultado del objetivo, mes a mes
// ---------------------------------------------------------------------
// Es el calendario de la pantalla principal: una celda por mes, y en
// cada una se registra lo que dio el objetivo ese mes. Direccion lo
// pidio el 8 de octubre, y por eso el seguimiento salio del formulario
// de la accion del plan: el resultado se mira acá, mes contra mes.
//
// SE GUARDA SEGUN EL TIPO DEL OBJETIVO. Si/No, texto o valor numerico:
// la misma distincion que ya hace el alta, para que el numerico se pueda
// comparar contra el minimo y el maximo esperables.

/** Registra —o corrige— el resultado de un mes. */
export async function registrarMedicionDelObjetivo(
  objetivoId: string,
  anio: number,
  mes: number,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    return { exito: false, error: "El mes no es válido." };
  }
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    return { exito: false, error: "El año no es válido." };
  }

  const { data: objetivo } = await supabase
    .from("objetivos")
    .select("id, codigo, tipo_resultado, unidad_valor")
    .eq("id", objetivoId)
    .maybeSingle();

  if (!objetivo) {
    return { exito: false, error: "El objetivo no existe o no tiene acceso." };
  }

  const tipo = (objetivo as { tipo_resultado: string | null }).tipo_resultado;

  const crudoNumero = String(datos.get("valor_numerico") ?? "").trim();
  const crudoSiNo = String(datos.get("resultado_si_no") ?? "").trim();
  const texto = String(datos.get("resultado_texto") ?? "").trim();

  // Solo se guarda lo que corresponde al tipo: si no, un objetivo
  // numerico arrastraria el texto que alguien escribio antes de cambiar
  // el tipo, y la celda mostraria dos resultados distintos.
  let valorNumerico: number | null = null;
  let resultadoSiNo: boolean | null = null;
  let resultadoTexto: string | null = null;

  if (tipo === "numerico") {
    if (crudoNumero === "" || Number.isNaN(Number(crudoNumero))) {
      return { exito: false, error: "Cargue el valor del mes." };
    }
    valorNumerico = Number(crudoNumero);
  } else if (tipo === "si_no") {
    if (crudoSiNo !== "si" && crudoSiNo !== "no") {
      return { exito: false, error: "Indique si el mes cumplió o no." };
    }
    resultadoSiNo = crudoSiNo === "si";
  } else {
    if (!texto) return { exito: false, error: "Escriba el resultado del mes." };
    resultadoTexto = texto;
  }

  // `upsert` sobre el indice unico (objetivo, año, mes): volver a tocar
  // la celda corrige, no duplica.
  const { error } = await supabase.from("objetivo_mediciones").upsert(
    {
      empresa_id: usuario.empresa_id,
      objetivo_id: objetivoId,
      anio,
      mes,
      valor_numerico: valorNumerico,
      resultado_si_no: resultadoSiNo,
      resultado_texto: resultadoTexto,
      comentario: String(datos.get("comentario") ?? "").trim() || null,
      creado_por: usuario.id,
    },
    { onConflict: "objetivo_id,anio,mes" },
  );

  if (error) {
    return { exito: false, error: `No se pudo registrar el mes: ${error.message}` };
  }

  revalidatePath("/indicadores");
  revalidatePath(`/indicadores/objetivos/${objetivoId}`);
  return { exito: true, mensaje: "Resultado del mes registrado." };
}

/** Borra el resultado de un mes, para la celda cargada por error. */
export async function borrarMedicionDelObjetivo(
  objetivoId: string,
  anio: number,
  mes: number,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("objetivo_mediciones")
    .delete()
    .eq("objetivo_id", objetivoId)
    .eq("anio", anio)
    .eq("mes", mes);

  if (error) return { exito: false, error: `No se pudo borrar el mes: ${error.message}` };

  revalidatePath("/indicadores");
  revalidatePath(`/indicadores/objetivos/${objetivoId}`);
  return { exito: true, mensaje: "Resultado del mes borrado." };
}
