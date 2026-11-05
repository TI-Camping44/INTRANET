/**
 * El muro saluda solo el día que alguien cumple años o cumple años en la
 * empresa.
 *
 * LA TARJETA DE LA DERECHA NO SE TOCA Y SIGUE SIENDO LA QUE AVISA ANTES.
 * Son dos cosas distintas y se pidieron juntas: la tarjeta mira treinta
 * días hacia adelante y sirve para agendar —«cumple en cuatro días»—, y
 * esto es el saludo del día, que ocupa el muro donde la gente comenta.
 * Sin la tarjeta nadie se entera con tiempo; sin el saludo hay que
 * acordarse de escribirlo a mano, que es justo lo que no pasa.
 *
 * SE PUBLICA UNA POR PERSONA, no una del día con todos los nombres: así
 * cada uno tiene su nombre, su foto y su hilo, y un cumpleaños no se
 * mezcla con un aniversario ajeno en la misma tarjeta.
 *
 * ALCANZA A QUIEN YA INGRESÓ, que es de donde salen las fechas:
 * `vista_efemerides` lee `usuarios`, no el padrón. Hoy son doce personas
 * de las cincuenta y cinco y crece solo a medida que la gente entra. Se
 * decidió así el 5 de noviembre: ampliarlo al padrón significaría
 * publicar el cumpleaños de alguien que todavía no usó el sistema ni
 * tiene foto cargada.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Una fila de `vista_efemerides`, acotada a lo que el saludo necesita. */
export interface EfemerideDelDia {
  id: string;
  nombre_completo: string;
  empresa_id: string;
  puesto: string | null;
  motivo: string;
  anos: number | null;
}

/**
 * Cuántos días queda el saludo en el muro.
 *
 * CERO: se vence el mismo día. El muro ya filtra por
 * `fecha_vencimiento >= hoy`, así que con la fecha de hoy la publicación
 * se ve hoy y mañana se va sola, sin que nadie la archive. Un saludo de
 * cumpleaños de la semana pasada arriba del muro es peor que no tenerlo.
 */
export const DIAS_QUE_DURA_EL_SALUDO = 0;

/** El primer nombre, que es como se saluda a alguien. */
function primerNombre(nombreCompleto: string): string {
  return nombreCompleto.trim().split(/\s+/)[0] ?? nombreCompleto;
}

/**
 * El texto del saludo.
 *
 * NO NOMBRA A LA EMPRESA y dice «en la empresa», igual que la tarjeta.
 * `empresa_id` es el inquilino y vale siempre Camping 44, también para
 * los once empleados de Vitalica: escribir «en Camping 44» les diría a
 * ellos algo que no corresponde.
 *
 * Registro neutro y sin voseo, como el resto del sistema.
 */
export function redactarSaludo(efemeride: EfemerideDelDia): {
  tipo: "cumpleanos" | "aniversario";
  titulo: string;
  cuerpo: string;
} | null {
  const nombre = primerNombre(efemeride.nombre_completo);

  // El cargo va como aposición, así que cierra con coma cuando queda en
  // el medio de la frase y con nada cuando queda al final, antes del
  // punto. Sin eso salía «…Rivas, Coordinador de Auditoría se sumó».
  const cargoAlFinal = efemeride.puesto ? `, ${efemeride.puesto}` : "";
  const cargoEnElMedio = efemeride.puesto ? `, ${efemeride.puesto},` : "";

  if (efemeride.motivo === "cumpleanos") {
    return {
      tipo: "cumpleanos",
      titulo: `¡Feliz cumpleaños, ${nombre}!`,
      cuerpo:
        `Hoy cumple años ${efemeride.nombre_completo}${cargoAlFinal}.\n\n` +
        "Que tenga un muy buen día.",
    };
  }

  // Sin los años no hay aniversario que anunciar: decir «cumple años en
  // la empresa» sin el número no agrega nada a lo que ya dice la tarjeta.
  if (efemeride.motivo === "aniversario" && efemeride.anos && efemeride.anos > 0) {
    const uno = efemeride.anos === 1;
    const anos = `${efemeride.anos} año${uno ? "" : "s"}`;

    return {
      tipo: "aniversario",
      titulo: `${nombre} cumple ${anos} en la empresa`,
      cuerpo:
        // «Se cumple un año» y «se cumplen cinco años»: el verbo va con
        // el número, no fijo en plural.
        `Hoy se cumple${uno ? "" : "n"} ${anos} desde que ` +
        `${efemeride.nombre_completo}${cargoEnElMedio} se sumó al equipo.\n\n` +
        "Gracias por este tiempo.",
    };
  }

  return null;
}

/**
 * Publica los saludos que correspondan a la fecha.
 *
 * ES IDEMPOTENTE Y TIENE QUE SERLO: el trabajo programado puede correr
 * dos veces el mismo día —se lo puede disparar a mano, y en el plan de
 * Vercel la corrida cae en cualquier momento dentro de la hora—. Antes
 * de escribir mira qué saludos ya existen para hoy, por persona y por
 * motivo, y saltea esos. Sin eso, la segunda corrida duplicaría el muro.
 *
 * Recibe el cliente ya armado, como `notificar()`: lo llama el trabajo
 * programado, que es de los dos únicos lugares donde se usa la clave de
 * servicio.
 */
export async function publicarEfemeridesDelDia(
  supabase: SupabaseClient,
  hoy: string,
): Promise<{ creadas: number; omitidas: number }> {
  const mes = Number(hoy.slice(5, 7));
  const dia = Number(hoy.slice(8, 10));

  const { data: delDia } = await supabase
    .from("vista_efemerides")
    .select("id, nombre_completo, empresa_id, puesto, motivo, anos")
    .eq("mes", mes)
    .eq("dia", dia);

  const efemerides = (delDia as EfemerideDelDia[] | null) ?? [];
  if (efemerides.length === 0) return { creadas: 0, omitidas: 0 };

  // Lo que ya se publicó hoy. El vencimiento es la fecha del saludo, así
  // que alcanza para identificarlo sin agregarle una columna a la tabla.
  const { data: yaPublicadas } = await supabase
    .from("publicaciones")
    .select("tipo, usuario_referido_id")
    .in("tipo", ["cumpleanos", "aniversario"])
    .eq("fecha_vencimiento", hoy);

  const existentes = new Set(
    ((yaPublicadas as { tipo: string; usuario_referido_id: string | null }[] | null) ?? []).map(
      (fila) => `${fila.tipo}:${fila.usuario_referido_id ?? ""}`,
    ),
  );

  const porCrear = efemerides
    .map((efemeride) => ({ efemeride, saludo: redactarSaludo(efemeride) }))
    .filter(
      (
        candidata,
      ): candidata is {
        efemeride: EfemerideDelDia;
        saludo: NonNullable<ReturnType<typeof redactarSaludo>>;
      } => candidata.saludo !== null,
    )
    .filter(
      ({ efemeride, saludo }) => !existentes.has(`${saludo.tipo}:${efemeride.id}`),
    );

  if (porCrear.length === 0) {
    return { creadas: 0, omitidas: efemerides.length };
  }

  const { error } = await supabase.from("publicaciones").insert(
    porCrear.map(({ efemeride, saludo }) => ({
      empresa_id: efemeride.empresa_id,
      tipo: saludo.tipo,
      titulo: saludo.titulo,
      cuerpo: saludo.cuerpo,
      estado: "publicada",
      fecha_publicacion: new Date().toISOString(),
      fecha_vencimiento: hoy,
      // DE QUIÉN HABLA. Es lo que hace que el muro muestre su foto y su
      // nombre, y la columna que el alta manual dejó de preguntar el 9
      // de octubre pero que la tabla conserva justamente para esto.
      usuario_referido_id: efemeride.id,
      // Sin autor: lo escribe el sistema y el muro ya lo rotula así.
      creado_por: null,
    })),
  );

  if (error) {
    throw new Error(`No se pudieron publicar los saludos del día: ${error.message}`);
  }

  return { creadas: porCrear.length, omitidas: efemerides.length - porCrear.length };
}
