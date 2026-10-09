"use server";

import { revalidatePath } from "next/cache";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import {
  admiteRechazo,
  casoCerrado,
  diasHabilesEntre,
  DIAS_VERIFICACION_PLAN_C,
  ESTADOS_CLIENTE_FINAL,
  exigeAccionCorrectiva,
  exigeNoConformidad,
  MAXIMO_COMPENSACIONES_ANUALES,
  planDelCaso,
  planSiguiente,
  puedePasarA,
  sumarDiasHabiles,
  vencimientosDelPlan,
  type EstadoClienteReclamo,
  type EstadoReclamo,
  type GravedadReclamo,
  type OrigenReclamo,
  type PlanReclamo,
  type TipoFallaReclamo,
} from "@/lib/reclamos";
import { hoyEnAsuncion, formatearFecha } from "@/lib/formato";
import { departe, notificar } from "@/lib/notificaciones";
import type { ResultadoAccion } from "@/lib/tipos";

/**
 * Escrituras del modulo de Reclamos de Clientes (MP-EST-04).
 *
 * TODO LO QUE EL PROCEDIMIENTO EXIGE SE VALIDA ACA, ademas de en los
 * CHECK de la base. Y cada paso pide lo suyo en su momento: contactar
 * pide la fecha del contacto, definir el plan pide acciones con
 * responsable y fecha, cerrar pide el estado final del cliente.
 */

interface CamposDelReclamo {
  titulo: string;
  descripcion: string;
  clienteId: string | null;
  clienteNombre: string;
  origen: OrigenReclamo;
  tipoFalla: TipoFallaReclamo;
  gravedad: GravedadReclamo;
  gestorId: string | null;
  responsableAreaId: string | null;
  materialControlado: boolean;
  departamentos: string[];
}

function leerCampos(datos: FormData): CamposDelReclamo {
  return {
    titulo: String(datos.get("titulo") ?? "").trim(),
    descripcion: String(datos.get("descripcion") ?? "").trim(),
    clienteId: String(datos.get("cliente_id") ?? "") || null,
    clienteNombre: String(datos.get("cliente_nombre") ?? "").trim(),
    origen: String(datos.get("origen") ?? "reclamo_directo") as OrigenReclamo,
    tipoFalla: String(datos.get("tipo_falla") ?? "otro") as TipoFallaReclamo,
    gravedad: String(datos.get("gravedad") ?? "leve") as GravedadReclamo,
    gestorId: String(datos.get("gestor_id") ?? "") || null,
    responsableAreaId: String(datos.get("responsable_area_id") ?? "") || null,
    materialControlado: datos.get("material_controlado") === "on",
    departamentos: datos.getAll("departamentos_intervinientes").map(String).filter(Boolean),
  };
}

function validar(campos: CamposDelReclamo): string | null {
  if (campos.titulo.length < 5) return "El título debe tener al menos 5 caracteres.";
  if (campos.descripcion.length < 15) {
    return "Describa qué ocurrió con al menos 15 caracteres: es la base del caso.";
  }
  if (campos.clienteNombre.length < 3) return "Indique el nombre del cliente.";

  // La regla de imparcialidad del procedimiento. La base la refuerza, pero
  // el mensaje tiene que explicar por que, no devolver un error de Postgres.
  if (
    campos.gestorId &&
    campos.responsableAreaId &&
    campos.gestorId === campos.responsableAreaId
  ) {
    return (
      "Quien originó la falla no puede gestionar el contacto con el cliente. " +
      "Si la falla se originó en la propia gestión, el caso lo lleva el jefe del canal."
    );
  }

  return null;
}

export async function crearReclamo(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) {
    return { exito: false, error: "El perfil de Dirección es de solo lectura." };
  }

  const campos = leerCampos(datos);
  const problema = validar(campos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();
  const hoy = hoyEnAsuncion();

  // REINCIDENCIA: segunda falla al mismo cliente en seis meses. La
  // resuelve la base, porque depende de lo que ya esta guardado. Sin
  // cliente identificado no se puede saber, y entonces no corre.
  let esReincidencia = false;
  if (campos.clienteId) {
    const { data } = await supabase.rpc("hay_reincidencia_de_reclamo", {
      p_cliente_id: campos.clienteId,
      p_fecha: hoy,
      p_excluir: null,
    });
    esReincidencia = data === true;
  }

  const plan = planDelCaso(campos.gravedad, esReincidencia);
  const vencimientos = vencimientosDelPlan(plan, hoy);

  const { data: codigo, error: errorCodigo } = await supabase.rpc("siguiente_codigo_reclamo", {
    p_empresa_id: usuario.empresa_id,
  });

  if (errorCodigo || !codigo) {
    return { exito: false, error: "No se pudo asignar el código del reclamo. Intente de nuevo." };
  }

  const { data: creado, error } = await supabase
    .from("reclamos")
    .insert({
      empresa_id: usuario.empresa_id,
      codigo,
      titulo: campos.titulo,
      descripcion: campos.descripcion,
      cliente_id: campos.clienteId,
      cliente_nombre: campos.clienteNombre,
      origen: campos.origen,
      tipo_falla: campos.tipoFalla,
      departamentos_intervinientes: campos.departamentos,
      gravedad: campos.gravedad,
      plan,
      estado: "registrado",
      gestor_id: campos.gestorId,
      responsable_area_id: campos.responsableAreaId,
      es_reincidencia: esReincidencia,
      material_controlado: campos.materialControlado,
      fecha_deteccion: hoy,
      fecha_limite_contacto: vencimientos.contacto,
      fecha_limite_plan: vencimientos.definicionPlan,
      fecha_limite_resolucion: vencimientos.resolucion,
      creado_por: usuario.id,
    })
    .select("id, codigo")
    .single();

  if (error || !creado) {
    return { exito: false, error: `No se pudo registrar el reclamo: ${error?.message ?? ""}` };
  }

  revalidatePath("/reclamos");
  const fila = creado as { id: string; codigo: string };

  // AL GESTOR SE LE AVISA, y en el mismo aviso va el plazo: el caso se le
  // asigna con 24 horas hábiles para llamar al cliente, y enterarse al
  // día siguiente ya es tarde.
  await avisarAlGestor(supabase, usuario, {
    id: fila.id,
    codigo: fila.codigo,
    titulo: campos.titulo,
    clienteNombre: campos.clienteNombre,
    gestorId: campos.gestorId,
    limiteContacto: vencimientos.contacto,
  });

  return {
    exito: true,
    id: fila.id,
    mensaje: esReincidencia
      ? `${fila.codigo} registrado. Es reincidencia: el plan subió un nivel.`
      : `${fila.codigo} registrado.`,
  };
}

export async function actualizarReclamo(id: string, datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) {
    return { exito: false, error: "El perfil de Dirección es de solo lectura." };
  }

  const campos = leerCampos(datos);
  const problema = validar(campos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();

  const { data: actual } = await supabase
    .from("reclamos")
    .select(
      "codigo, estado, plan, gravedad, fecha_deteccion, fecha_contacto, rechazos, " +
        "gestor_id, fecha_limite_contacto",
    )
    .eq("id", id)
    .maybeSingle();

  const previo = actual as
    | {
        codigo: string;
        estado: EstadoReclamo;
        plan: PlanReclamo;
        gravedad: GravedadReclamo;
        fecha_deteccion: string;
        fecha_contacto: string | null;
        rechazos: number;
        gestor_id: string | null;
        fecha_limite_contacto: string;
      }
    | null;

  if (!previo) return { exito: false, error: "No se encontró el reclamo." };
  if (previo.estado === "cerrado" || previo.estado === "no_conciliado") {
    return { exito: false, error: "Un caso cerrado no se edita." };
  }

  const parche: Record<string, unknown> = {
    titulo: campos.titulo,
    descripcion: campos.descripcion,
    cliente_id: campos.clienteId,
    cliente_nombre: campos.clienteNombre,
    origen: campos.origen,
    tipo_falla: campos.tipoFalla,
    departamentos_intervinientes: campos.departamentos,
    gestor_id: campos.gestorId,
    responsable_area_id: campos.responsableAreaId,
    material_controlado: campos.materialControlado,
  };

  // Si cambia la gravedad, el plan y los plazos se recalculan. NUNCA HACIA
  // ABAJO: el plan pudo haber escalado por rechazo del cliente, y volver
  // atras le quitaria al caso los plazos que ya le correspondian.
  if (campos.gravedad !== previo.gravedad) {
    const { data: reincidencia } = campos.clienteId
      ? await supabase.rpc("hay_reincidencia_de_reclamo", {
          p_cliente_id: campos.clienteId,
          p_fecha: previo.fecha_deteccion,
          p_excluir: id,
        })
      : { data: false };

    const planBase = planDelCaso(campos.gravedad, reincidencia === true);
    const orden: PlanReclamo[] = ["a", "b", "c"];
    const plan =
      orden.indexOf(planBase) >= orden.indexOf(previo.plan) ? planBase : previo.plan;

    const desde = previo.fecha_contacto ?? previo.fecha_deteccion;
    const vencimientos = vencimientosDelPlan(plan, desde);

    parche.gravedad = campos.gravedad;
    parche.plan = plan;
    parche.es_reincidencia = reincidencia === true;
    parche.fecha_limite_contacto = vencimientos.contacto;
    parche.fecha_limite_plan = vencimientos.definicionPlan;
    parche.fecha_limite_resolucion = vencimientos.resolucion;
  }

  const { error } = await supabase.from("reclamos").update(parche).eq("id", id);
  if (error) return { exito: false, error: `No se pudo guardar: ${error.message}` };

  // Cambiar de gestor es reasignar el caso, no corregir un dato: al que
  // entra hay que avisarle igual que en el alta.
  if (campos.gestorId && campos.gestorId !== previo.gestor_id) {
    await avisarAlGestor(supabase, usuario, {
      id,
      codigo: previo.codigo,
      titulo: campos.titulo,
      clienteNombre: campos.clienteNombre,
      gestorId: campos.gestorId,
      limiteContacto: String(parche.fecha_limite_contacto ?? previo.fecha_limite_contacto),
    });
  }

  revalidatePath("/reclamos");
  revalidatePath(`/reclamos/${id}`);
  return { exito: true, mensaje: "Reclamo actualizado." };
}

/**
 * Registra que el cliente rechazo la propuesta.
 *
 * El caso escala al plan siguiente para una SEGUNDA PROPUESTA, y por eso
 * vuelve a «contactado» con los plazos del plan nuevo: el procedimiento
 * pide otra propuesta, no una nota al pie.
 *
 * Rechazado el Plan C no hay nivel superior: queda la oferta final o el
 * cierre como «No conciliado», y eso lo decide una persona.
 */
export async function registrarRechazo(id: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) {
    return { exito: false, error: "El perfil de Dirección es de solo lectura." };
  }

  const supabase = crearClienteServidor();
  const { data: actual } = await supabase
    .from("reclamos")
    .select("codigo, estado, plan, rechazos, fecha_contacto, fecha_deteccion")
    .eq("id", id)
    .maybeSingle();

  const reclamo = actual as
    | {
        codigo: string;
        estado: EstadoReclamo;
        plan: PlanReclamo;
        rechazos: number;
        fecha_contacto: string | null;
        fecha_deteccion: string;
      }
    | null;

  if (!reclamo) return { exito: false, error: "No se encontró el reclamo." };
  if (!admiteRechazo(reclamo.estado)) {
    return {
      exito: false,
      error: "Solo se puede registrar un rechazo después de haberle propuesto algo al cliente.",
    };
  }

  const plan = planSiguiente(reclamo.plan);
  const yaEstabaEnC = plan === reclamo.plan;
  const desde = reclamo.fecha_contacto ?? reclamo.fecha_deteccion;
  const vencimientos = vencimientosDelPlan(plan, desde);

  const { error } = await supabase
    .from("reclamos")
    .update({
      plan,
      rechazos: reclamo.rechazos + 1,
      estado: "contactado",
      fecha_limite_plan: vencimientos.definicionPlan,
      fecha_limite_resolucion: vencimientos.resolucion,
    })
    .eq("id", id);

  if (error) return { exito: false, error: `No se pudo registrar el rechazo: ${error.message}` };

  revalidatePath("/reclamos");
  revalidatePath(`/reclamos/${id}`);

  return {
    exito: true,
    mensaje: yaEstabaEnC
      ? `${reclamo.codigo}: rechazo registrado. Ya estaba en Plan C: queda la oferta final o cerrar como no conciliado.`
      : `${reclamo.codigo}: escaló al Plan ${plan.toUpperCase()} para una segunda propuesta.`,
  };
}

/** Mueve el caso por el ciclo. Cada paso pide lo que el procedimiento exige. */
export async function cambiarEstadoReclamo(
  id: string,
  nuevoEstado: EstadoReclamo,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) {
    return { exito: false, error: "El perfil de Dirección es de solo lectura." };
  }

  const supabase = crearClienteServidor();

  const { data: actual } = await supabase
    .from("reclamos")
    .select(
      "id, codigo, estado, plan, cliente_id, fecha_deteccion, fecha_contacto, no_conformidad_id",
    )
    .eq("id", id)
    .maybeSingle();

  const reclamo = actual as
    | {
        id: string;
        codigo: string;
        estado: EstadoReclamo;
        plan: PlanReclamo;
        cliente_id: string | null;
        fecha_deteccion: string;
        fecha_contacto: string | null;
        no_conformidad_id: string | null;
      }
    | null;

  if (!reclamo) return { exito: false, error: "No se encontró el reclamo." };

  if (!puedePasarA(reclamo.estado, nuevoEstado)) {
    return { exito: false, error: "Ese paso no está permitido desde el estado actual." };
  }

  const hoy = hoyEnAsuncion();
  const parche: Record<string, unknown> = { estado: nuevoEstado };

  if (nuevoEstado === "contactado") {
    const fecha = String(datos.get("fecha_contacto") ?? "") || hoy;
    parche.fecha_contacto = fecha;

    // El plazo de resolucion se cuenta DESDE EL CONTACTO, no desde la
    // deteccion. Al registrar el caso se calcula provisorio con la fecha
    // de deteccion; recien acá queda el definitivo.
    const vencimientos = vencimientosDelPlan(reclamo.plan, fecha);
    parche.fecha_limite_plan = vencimientos.definicionPlan;
    parche.fecha_limite_resolucion = vencimientos.resolucion;
  }

  if (nuevoEstado === "plan_definido") {
    // LAS ACCIONES SE CARGAN EN ESTE MISMO PASO. Definir el plan ES
    // decir que se hace, quien lo hace y cuando: antes el paso solo
    // pedia la fecha y despues rechazaba el cambio pidiendo que las
    // acciones se cargaran en otra tarjeta, que es una vuelta que nadie
    // adivina. Las que vengan en el formulario se agregan; las que ya
    // estaban no se tocan.
    const { filas, error: problema } = leerAccionesDelPlan(datos);
    if (problema) return { exito: false, error: problema };

    if (filas.length > 0) {
      const { error: alGuardar } = await supabase.from("reclamo_acciones").insert(
        filas.map((fila) => ({
          reclamo_id: id,
          descripcion: fila.descripcion,
          responsable_id: fila.responsable_id,
          fecha_limite: fila.fecha_limite,
        })),
      );
      if (alGuardar) {
        return {
          exito: false,
          error: `No se pudieron guardar las acciones del plan: ${alGuardar.message}`,
        };
      }
    }

    const { count } = await supabase
      .from("reclamo_acciones")
      .select("id", { count: "exact", head: true })
      .eq("reclamo_id", id);

    if (!count) {
      return {
        exito: false,
        error:
          "Cargue al menos una acción del plan, con responsable y fecha: el procedimiento pide " +
          "qué se hace, quién lo hace y cuándo.",
      };
    }

    parche.fecha_definicion_plan = String(datos.get("fecha_definicion_plan") ?? "") || hoy;
    parche.tramite_digemabel = datos.get("tramite_digemabel") === "on";
    if (parche.tramite_digemabel) parche.suspendido_desde = hoy;
    parche.notificado_gerencia = datos.get("notificado_gerencia") === "on";
  }

  if (nuevoEstado === "resuelto") {
    parche.fecha_resolucion = String(datos.get("fecha_resolucion") ?? "") || hoy;

    const detalle = String(datos.get("compensacion_detalle") ?? "").trim();
    const monto = Number(String(datos.get("compensacion_monto") ?? "").replace(/[^\d-]/g, ""));
    const factura = Number(String(datos.get("monto_factura") ?? "").replace(/[^\d-]/g, ""));
    const conformidad = datos.get("conformidad_firmada") === "on";

    parche.compensacion_detalle = detalle || null;
    parche.compensacion_monto = Number.isFinite(monto) && monto > 0 ? monto : null;
    parche.monto_factura = Number.isFinite(factura) && factura > 0 ? factura : null;
    parche.conformidad_firmada = conformidad;
    parche.autorizado_por = String(datos.get("autorizado_por") ?? "") || null;

    if (Number.isFinite(monto) && monto > 0) {
      // Toda compensacion economica exige la conformidad firmada del
      // cliente ANTES de ejecutarse. La base tambien lo impide.
      if (!conformidad) {
        return {
          exito: false,
          error: "Una compensación económica exige la conformidad firmada del cliente.",
        };
      }
      if (!parche.autorizado_por) {
        return { exito: false, error: "Indique quién autorizó la compensación." };
      }
      // La autorizacion tiene fecha propia: es la que vale para la
      // auditoria, no la de resolucion del caso.
      parche.fecha_autorizacion = parche.fecha_resolucion;

      // Un mismo cliente no puede recibir mas de dos compensaciones
      // economicas por año; desde la tercera hay que evaluar si hay un
      // patron de reclamo sistematico.
      if (reclamo.cliente_id) {
        const { count } = await supabase
          .from("reclamos")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", reclamo.cliente_id)
          .neq("id", id)
          .gt("compensacion_monto", 0)
          .gte("fecha_deteccion", `${hoy.slice(0, 4)}-01-01`);

        if ((count ?? 0) >= MAXIMO_COMPENSACIONES_ANUALES) {
          return {
            exito: false,
            error:
              `Este cliente ya recibió ${count} compensaciones económicas este año. Desde la ` +
              "tercera, el jefe del canal tiene que evaluar si corresponde o si hay un patrón " +
              "de reclamo sistemático.",
          };
        }
      }
    }
  }

  if (nuevoEstado === "cerrado") {
    const estadoCliente = String(datos.get("estado_cliente") ?? "") as EstadoClienteReclamo;
    if (!ESTADOS_CLIENTE_FINAL.includes(estadoCliente)) {
      return { exito: false, error: "Indique con qué estado queda el cliente." };
    }

    // Planes B y C no cierran sin la accion correctiva ejecutada: sin eso
    // el caso se resolvio para el cliente pero la causa sigue viva.
    if (exigeAccionCorrectiva(reclamo.plan)) {
      const { count } = await supabase
        .from("reclamo_acciones")
        .select("id", { count: "exact", head: true })
        .eq("reclamo_id", id)
        .is("ejecutada_en", null);

      if (count) {
        return {
          exito: false,
          error:
            `Quedan ${count} acciones sin ejecutar. En el Plan ${reclamo.plan.toUpperCase()} el ` +
            "caso no se cierra sin la acción correctiva confirmada.",
        };
      }
    }

    parche.estado_cliente = estadoCliente;
    parche.fecha_cierre = hoy;
  }

  if (nuevoEstado === "no_conciliado") {
    const motivo = String(datos.get("motivo_no_conciliado") ?? "").trim();
    if (motivo.length < 10) {
      return { exito: false, error: "Deje el motivo del cierre sin conciliar: al menos 10 caracteres." };
    }
    parche.motivo_no_conciliado = motivo;
    parche.estado_cliente = "no_conciliado";
    parche.fecha_cierre = hoy;
  }

  const { error } = await supabase.from("reclamos").update(parche).eq("id", id);
  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };

  // PLAN C ABRE NO CONFORMIDAD, por definicion y no por decision. Se hace
  // al definir el plan, que es cuando el procedimiento pide el analisis
  // de causa. La base lo arma en una sola operacion y es idempotente.
  if (nuevoEstado === "plan_definido" && exigeNoConformidad(reclamo.plan) && !reclamo.no_conformidad_id) {
    const { error: errorNc } = await supabase.rpc("generar_no_conformidad_desde_reclamo", {
      p_reclamo_id: id,
    });

    if (errorNc) {
      revalidatePath(`/reclamos/${id}`);
      return {
        exito: false,
        error:
          `El plan quedó definido, pero no se pudo abrir la no conformidad: ${errorNc.message}. ` +
          "Avise a TI: el caso está bien guardado, falta solo la derivación.",
      };
    }
    revalidatePath("/no-conformidades");
  }

  revalidatePath("/reclamos");
  revalidatePath(`/reclamos/${id}`);
  return { exito: true, mensaje: `${reclamo.codigo} actualizado.` };
}

/** Las acciones del plan: que se hace, quien lo hace y cuando. */
/** Una accion del plan tal como llega del formulario. */
interface AccionEnviada {
  id: string | null;
  descripcion: string;
  responsable_id: string | null;
  fecha_limite: string | null;
  ejecutada_en: string | null;
}

/**
 * Lee las acciones del formulario y las revisa.
 *
 * La comparten la tarjeta de acciones y el paso «Definir el plan de
 * accion»: el procedimiento pide lo mismo en los dos lados —que se
 * hace, quien lo hace y cuando— y tener dos lecturas distintas era
 * tener dos reglas que se iban a separar.
 */
function leerAccionesDelPlan(datos: FormData): {
  filas: AccionEnviada[];
  error: string | null;
} {
  const ids = datos.getAll("accion_id").map(String);
  const descripciones = datos.getAll("accion_descripcion").map((v) => String(v).trim());
  const responsables = datos.getAll("accion_responsable").map(String);
  const plazos = datos.getAll("accion_fecha_limite").map(String);
  const ejecutadas = datos.getAll("accion_ejecutada_en").map(String);

  const filas = descripciones
    .map((descripcion, indice) => ({
      id: ids[indice] || null,
      descripcion,
      responsable_id: responsables[indice] || null,
      fecha_limite: plazos[indice] || null,
      ejecutada_en: ejecutadas[indice] || null,
    }))
    .filter((fila) => fila.descripcion.length > 0);

  for (const fila of filas) {
    if (fila.descripcion.length < 10) {
      return { filas, error: "Describa cada acción con al menos 10 caracteres." };
    }
    if (!fila.responsable_id) {
      return { filas, error: "Cada acción necesita un responsable." };
    }
    if (!fila.fecha_limite) {
      return { filas, error: "Cada acción necesita una fecha límite." };
    }
  }

  return { filas, error: null };
}

export async function guardarAccionesDelPlan(
  reclamoId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) {
    return { exito: false, error: "El perfil de Dirección es de solo lectura." };
  }

  const supabase = crearClienteServidor();

  const { filas, error: problema } = leerAccionesDelPlan(datos);
  if (problema) return { exito: false, error: problema };
  if (filas.length === 0) {
    return { exito: false, error: "Cargue al menos una acción." };
  }

  // Las que se sacaron del formulario se borran primero, para que la
  // cuenta de pendientes que mira el cierre quede bien de una vez.
  const conservados = filas.map((f) => f.id).filter(Boolean) as string[];
  const { data: existentes } = await supabase
    .from("reclamo_acciones")
    .select("id")
    .eq("reclamo_id", reclamoId);

  const sobrantes = ((existentes as { id: string }[] | null) ?? [])
    .map((f) => f.id)
    .filter((id) => !conservados.includes(id));

  if (sobrantes.length > 0) {
    await supabase.from("reclamo_acciones").delete().in("id", sobrantes);
  }

  for (const fila of filas) {
    if (fila.id) {
      await supabase
        .from("reclamo_acciones")
        .update({
          descripcion: fila.descripcion,
          responsable_id: fila.responsable_id,
          fecha_limite: fila.fecha_limite,
          ejecutada_en: fila.ejecutada_en,
        })
        .eq("id", fila.id);
    } else {
      // Sin el `id`: en un alta lo pone la base, y mandarlo en nulo
      // rompe el insert.
      const { id: _sinUsar, ...nueva } = fila;
      await supabase.from("reclamo_acciones").insert({ ...nueva, reclamo_id: reclamoId });
    }
  }

  revalidatePath(`/reclamos/${reclamoId}`);
  return { exito: true, mensaje: "Acciones del plan guardadas." };
}

export async function eliminarReclamo(id: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (usuario.rol !== "administrador_sgc") {
    return { exito: false, error: "Solo el Administrador SGC puede eliminar un reclamo." };
  }

  const supabase = crearClienteServidor();
  const { error } = await supabase.from("reclamos").delete().eq("id", id);
  if (error) return { exito: false, error: `No se pudo eliminar: ${error.message}` };

  revalidatePath("/reclamos");
  return { exito: true, mensaje: "Reclamo eliminado." };
}

/**
 * Reanuda el plazo que estaba suspendido por un trámite ante la DIGEMABEL.
 *
 * SUSPENDER SIN PODER REANUDAR NO ES SUSPENDER, ES CANCELAR. Mientras el
 * trámite está en curso el caso no cuenta como fuera de plazo; cuando
 * termina, los días hábiles que duró se le devuelven al plazo y el caso
 * vuelve a correr. Sin esto un caso quedaba suspendido para siempre y el
 * plazo dejaba de significar algo.
 *
 * No se guarda un acumulado de días suspendidos porque no hace falta: la
 * bitácora registra cada suspensión y cada reanudación con su fecha, que
 * es lo que una auditoría pide ver.
 */
export async function reanudarPlazoSuspendido(id: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) {
    return { exito: false, error: "El perfil de Dirección es de solo lectura." };
  }

  const supabase = crearClienteServidor();
  const { data: actual } = await supabase
    .from("reclamos")
    .select(
      "codigo, estado, tramite_digemabel, suspendido_desde, fecha_definicion_plan, " +
        "fecha_limite_plan, fecha_limite_resolucion",
    )
    .eq("id", id)
    .maybeSingle();

  const reclamo = actual as
    | {
        codigo: string;
        estado: EstadoReclamo;
        tramite_digemabel: boolean;
        suspendido_desde: string | null;
        fecha_definicion_plan: string | null;
        fecha_limite_plan: string;
        fecha_limite_resolucion: string;
      }
    | null;

  if (!reclamo) return { exito: false, error: "No se encontró el reclamo." };
  if (!reclamo.tramite_digemabel || !reclamo.suspendido_desde) {
    return { exito: false, error: "Este caso no tiene el plazo suspendido." };
  }
  if (casoCerrado(reclamo.estado)) {
    return { exito: false, error: "El caso ya está cerrado: no hay plazo que reanudar." };
  }

  const hoy = hoyEnAsuncion();
  const dias = diasHabilesEntre(reclamo.suspendido_desde, hoy);

  const parche: Record<string, unknown> = {
    tramite_digemabel: false,
    suspendido_desde: null,
    fecha_limite_resolucion: sumarDiasHabiles(reclamo.fecha_limite_resolucion, dias),
  };

  // El plazo del plan solo se corre si el plan todavía no se definió: ya
  // definido, moverlo sería reescribir algo que se cumplió.
  if (!reclamo.fecha_definicion_plan) {
    parche.fecha_limite_plan = sumarDiasHabiles(reclamo.fecha_limite_plan, dias);
  }

  const { error } = await supabase.from("reclamos").update(parche).eq("id", id);
  if (error) return { exito: false, error: `No se pudo reanudar el plazo: ${error.message}` };

  revalidatePath("/reclamos");
  revalidatePath(`/reclamos/${id}`);

  return {
    exito: true,
    mensaje:
      dias === 0
        ? `${reclamo.codigo}: plazo reanudado, sin días para devolver.`
        : `${reclamo.codigo}: plazo reanudado. Se le devolvieron ${dias} ` +
          `día${dias === 1 ? "" : "s"} hábil${dias === 1 ? "" : "es"}.`,
  };
}

/**
 * La verificación con el cliente a los 30 días de cerrar un Plan C.
 *
 * Es del procedimiento y es lo único que distingue un caso cerrado de un
 * caso resuelto: que alguien volvió a preguntarle al cliente si la
 * solución sirvió. Solo aplica al Plan C.
 */
export async function registrarVerificacion(
  id: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) {
    return { exito: false, error: "El perfil de Dirección es de solo lectura." };
  }

  const observacion = String(datos.get("verificacion_observacion") ?? "").trim();
  if (observacion.length < 10) {
    return {
      exito: false,
      error: "Deje qué dijo el cliente al verificar: al menos 10 caracteres.",
    };
  }

  const supabase = crearClienteServidor();
  const { data: actual } = await supabase
    .from("reclamos")
    .select("codigo, estado, plan")
    .eq("id", id)
    .maybeSingle();

  const reclamo = actual as
    | { codigo: string; estado: EstadoReclamo; plan: PlanReclamo }
    | null;

  if (!reclamo) return { exito: false, error: "No se encontró el reclamo." };
  if (!exigeNoConformidad(reclamo.plan)) {
    return {
      exito: false,
      error: `La verificación a los ${DIAS_VERIFICACION_PLAN_C} días es del Plan C.`,
    };
  }
  if (!casoCerrado(reclamo.estado)) {
    return { exito: false, error: "La verificación se hace después de cerrar el caso." };
  }

  const { error } = await supabase
    .from("reclamos")
    .update({
      fecha_verificacion: String(datos.get("fecha_verificacion") ?? "") || hoyEnAsuncion(),
      verificacion_observacion: observacion,
    })
    .eq("id", id);

  if (error) {
    return { exito: false, error: `No se pudo guardar la verificación: ${error.message}` };
  }

  revalidatePath("/reclamos");
  revalidatePath(`/reclamos/${id}`);
  return { exito: true, mensaje: `${reclamo.codigo}: verificación registrada.` };
}

/**
 * Le avisa al gestor que el caso es suyo.
 *
 * Sin esto la asignación no existe: queda un nombre en un campo que la
 * persona se entera de mirar si abre el listado. El aviso lleva el plazo
 * del primer contacto porque es lo que hay que hacer primero y es el más
 * corto de todos.
 *
 * No avisa cuando alguien se asigna a sí mismo: ya lo sabe.
 */
async function avisarAlGestor(
  supabase: ReturnType<typeof crearClienteServidor>,
  usuario: { id: string; nombre_completo: string; correo: string },
  caso: {
    id: string;
    codigo: string;
    titulo: string;
    clienteNombre: string;
    gestorId: string | null;
    limiteContacto: string;
  },
): Promise<void> {
  if (!caso.gestorId || caso.gestorId === usuario.id) return;

  const { data } = await supabase
    .from("usuarios")
    .select("id, correo")
    .eq("id", caso.gestorId)
    .maybeSingle();

  const gestor = data as { id: string; correo: string } | null;
  if (!gestor) return;

  await notificar(supabase, {
    deParteDe: departe(usuario),
    usuarioId: gestor.id,
    correoDestino: gestor.correo,
    tipo: "reclamo_asignado",
    titulo: `Reclamo asignado · ${caso.codigo}`,
    mensaje:
      `${usuario.nombre_completo} le asignó el reclamo de ${caso.clienteNombre}: ` +
      `"${caso.titulo}". Tiene plazo para el primer contacto hasta el ` +
      `${formatearFecha(caso.limiteContacto)}.`,
    enlace: `/reclamos/${caso.id}`,
    entidad: "reclamos",
    entidadId: caso.id,
    claveUnicidad: `reclamo-asignado:${caso.id}:${gestor.id}`,
  });
}
