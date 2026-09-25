/**
 * Lectura de la planilla del informe comercial.
 *
 * DE DONDE SALE EL NUMERO. El informe comercial que la empresa ya usa
 * baja las facturas de Odoo a una hoja `DATA` —una fila por linea de
 * factura— y guarda los objetivos en una hoja `CONFIG`. El tablero de
 * GitHub Pages lee esas dos hojas publicadas como CSV y calcula todo en
 * el navegador. La intranet lee EXACTAMENTE LAS MISMAS DOS HOJAS.
 *
 * Por eso este archivo es un espejo declarado de ese tablero: las reglas
 * de abajo —a quien se excluye, como se limpia un nombre, como se cuentan
 * los dias habiles— estan copiadas de ahi a proposito. Si alguna cambia
 * alla, hay que cambiarla aca, o los dos numeros se separan y nadie sabe
 * cual creer.
 *
 * Lo que NO se replica es el calculo de la venta: la columna `TOTAL GS`
 * ya viene resuelta por el Apps Script, con sus reglas de anticipos,
 * notas de credito y tipo de cambio. Aca solamente se suma.
 *
 * ESTE ARCHIVO NO HACE PEDIDOS DE RED. El pedido lo hace
 * `ventas-servidor.ts`.
 */

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Parte un CSV en filas y celdas.
 *
 * Se escribe a mano y no con una libreria porque es lo unico que se
 * necesita: hay que respetar las comillas —los nombres de cliente traen
 * comas— y los saltos de linea dentro de una celda entrecomillada, que es
 * donde fallan los `split(",")`.
 */
export function analizarCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;

  for (let i = 0; i < texto.length; i += 1) {
    const caracter = texto[i];

    if (entreComillas) {
      if (caracter === '"') {
        // Dos comillas seguidas son una comilla literal.
        if (texto[i + 1] === '"') {
          celda += '"';
          i += 1;
        } else {
          entreComillas = false;
        }
      } else {
        celda += caracter;
      }
      continue;
    }

    if (caracter === '"') {
      entreComillas = true;
    } else if (caracter === ",") {
      fila.push(celda);
      celda = "";
    } else if (caracter === "\n") {
      fila.push(celda.replace(/\r$/, ""));
      filas.push(fila);
      fila = [];
      celda = "";
    } else {
      celda += caracter;
    }
  }

  fila.push(celda.replace(/\r$/, ""));
  filas.push(fila);

  // La ultima linea del archivo deja una fila de una celda vacia.
  return filas.filter((f) => f.length > 1 || f[0] !== "");
}

/**
 * Convierte a numero un importe de la planilla.
 *
 * CUIDADO CON EL PUNTO. La hoja esta en configuracion regional española,
 * asi que el CSV puede traer `1.234.567` (punto de miles) o `1234567`
 * segun como quedo formateada la celda. Un `parseFloat` directo lee
 * `1.234.567` como 1,234 y el objetivo de un vendedor queda en tres
 * guaranies.
 *
 * La regla: manda el separador que aparece ULTIMO. Si solo hay puntos y
 * el ultimo grupo tiene exactamente tres digitos, es separador de miles
 * —el guarani no tiene centavos, `1.234` nunca es «uno con doscientos».
 */
export function aNumero(texto: string | undefined | null): number {
  if (texto === undefined || texto === null) return 0;

  const limpio = String(texto).replace(/[^\d.,-]/g, "").trim();
  if (limpio === "" || limpio === "-") return 0;

  const negativo = limpio.startsWith("-");
  const cuerpo = limpio.replace(/-/g, "");

  const ultimaComa = cuerpo.lastIndexOf(",");
  const ultimoPunto = cuerpo.lastIndexOf(".");

  let normalizado: string;

  if (ultimaComa === -1 && ultimoPunto === -1) {
    normalizado = cuerpo;
  } else if (ultimaComa > ultimoPunto) {
    // Coma decimal: los puntos son miles.
    normalizado = cuerpo.replace(/\./g, "").replace(",", ".");
  } else {
    const decimales = cuerpo.length - ultimoPunto - 1;
    if (decimales === 3 && ultimaComa === -1) {
      // `1.234`, `1.234.567`: punto de miles.
      normalizado = cuerpo.replace(/\./g, "");
    } else {
      // `1,234.56`: punto decimal, comas de miles.
      normalizado = cuerpo.replace(/,/g, "");
    }
  }

  const valor = Number(normalizado);
  if (!Number.isFinite(valor)) return 0;
  return negativo ? -valor : valor;
}

/* ------------------------------------------------------------------ */
/* Nombres                                                             */
/* ------------------------------------------------------------------ */

/** Sin tildes, en mayusculas, con los espacios colapsados. */
export function normalizar(texto: string | undefined | null): string {
  if (!texto) return "";
  return String(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * El nombre del vendedor sin el canal pegado atras.
 *
 * En `DATA` el vendedor viene etiquetado: «Antonio Fernandez - Mayoristas».
 * En `CONFIG` viene pelado. Sin quitar el sufijo no se unen nunca.
 */
export function limpiarNombre(texto: string | undefined | null): string {
  return normalizar(texto).replace(
    /\s*-\s*(SALON|ONLINE|E-COMMERCE|ECOMMERCE|MAYORISTAS|VENTA EXTERNA|REPARACIONES|DIRECTORIO)\s*$/,
    "",
  );
}

/**
 * Si dos nombres son la misma persona.
 *
 * NO ALCANZA CON COMPARAR IGUAL. La misma persona figura como «Antonio
 * Fernandez» en un lado y «Antonio De Jesus Fernandez Benitez» en el
 * otro. Se acepta cuando uno es subconjunto del otro POR PALABRAS
 * COMPLETAS y comparten al menos dos.
 *
 * Las dos condiciones son necesarias. Por palabras completas, para que
 * «Sosa» no coincida con «Sosaro»; con dos palabras como minimo, para que
 * dos «Oscar David» distintos no se mezclen. Alguien viendo las ventas de
 * otro es el peor error posible de esta pantalla.
 */
export function mismoVendedor(a: string | undefined | null, b: string | undefined | null): boolean {
  const limpioA = limpiarNombre(a);
  const limpioB = limpiarNombre(b);
  if (!limpioA || !limpioB) return false;
  if (limpioA === limpioB) return true;

  const palabrasA = limpioA.split(" ").filter((p) => p.length > 2);
  const palabrasB = limpioB.split(" ").filter((p) => p.length > 2);
  if (palabrasA.length === 0 || palabrasB.length === 0) return false;

  const setA = new Set(palabrasA);
  const setB = new Set(palabrasB);
  const aDentroDeB = palabrasA.every((p) => setB.has(p));
  const bDentroDeA = palabrasB.every((p) => setA.has(p));

  if (aDentroDeB || bDentroDeA) {
    return Math.min(palabrasA.length, palabrasB.length) >= 2;
  }
  return false;
}

/**
 * A quien no se cuenta.
 *
 * Son administrativos y bucles internos que el tablero descarta: si la
 * intranet los sumara, un comercial veria un numero distinto al que ve
 * Dirección en el tablero. La lista sale de ahi tal cual.
 */
const VENDEDORES_EXCLUIDOS = [
  "MOREL CANDIA",
  "CESAR FABIAN",
  "GONZALEZ VALLEJOS",
  "PINEDA VALLEJOS",
  "DERLIS",
];

export function vendedorSeCuenta(vendedor: string): boolean {
  const limpio = limpiarNombre(vendedor);
  // «SALON» a secas no es una persona: son las facturas internas sin
  // vendedor real (Camping 44 S.A. a si misma) que caen en ese bolsillo.
  if (limpio === "SALON" || limpio === "" || limpio === "SIN VENDEDOR") return false;
  return !VENDEDORES_EXCLUIDOS.some((excluido) => limpio.includes(excluido));
}

/* ------------------------------------------------------------------ */
/* Canal                                                               */
/* ------------------------------------------------------------------ */

/** El canal real, que puede venir en el nombre del vendedor o en su columna. */
export function canalReal(vendedor: string, canalPlanilla: string): string {
  const v = limpiarNombre(vendedor);
  const c = normalizar(canalPlanilla);

  if (v.includes("BARBARA") && v.includes("CASCO")) return "Mayoristas";
  if (v.includes("CONTIMARKET") || c.includes("CONTIMARKET")) return "E-commerce";

  for (const texto of [v, c]) {
    if (texto.includes("DIRECTORIO")) return "Directorio";
    if (texto.includes("EXTERNA")) return "Venta Externa";
    if (texto.includes("REPARACIONES") || texto.includes("TALLER")) return "Reparaciones";
    if (texto.includes("MAYORISTA")) return "Mayoristas";
    if (texto.includes("E-COMMERCE") || texto.includes("ECOMMERCE")) return "E-commerce";
    if (texto.includes("ONLINE")) return "Online";
    if (texto.includes("SALON")) return "Salon";
  }

  return canalPlanilla.trim() || "Salon";
}

/* ------------------------------------------------------------------ */
/* Fechas y dias habiles                                               */
/* ------------------------------------------------------------------ */

export interface FechaPlanilla {
  anio: number;
  mes: number;
  dia: number;
}

/** Acepta `31/08/2026` y `2026-08-31`, que es como llegan segun la celda. */
export function aFecha(texto: string | undefined | null): FechaPlanilla | null {
  if (!texto) return null;
  const solo = String(texto).trim().split(" ")[0];

  const barras = solo.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (barras) {
    return { dia: Number(barras[1]), mes: Number(barras[2]), anio: Number(barras[3]) };
  }

  const guiones = solo.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (guiones) {
    return { anio: Number(guiones[1]), mes: Number(guiones[2]), dia: Number(guiones[3]) };
  }

  return null;
}

export function claveDeFecha(fecha: FechaPlanilla): string {
  return `${fecha.anio}-${String(fecha.mes).padStart(2, "0")}-${String(fecha.dia).padStart(2, "0")}`;
}

/**
 * Cuenta dias habiles entre dos fechas, inclusive.
 *
 * Lunes a viernes valen 1, el sabado medio dia, el domingo nada, y los
 * feriados no cuentan. Es el criterio que usa Comercial para repartir el
 * objetivo del mes; no es una convencion de este archivo.
 *
 * Se cuenta con `Date.UTC` a proposito: aca solo interesa el dia de la
 * semana, y en hora local un cambio de horario puede correr un dia.
 */
export function diasHabiles(
  desde: FechaPlanilla,
  hasta: FechaPlanilla,
  feriados: Set<string>,
): number {
  let total = 0;
  const fin = Date.UTC(hasta.anio, hasta.mes - 1, hasta.dia);
  let actual = Date.UTC(desde.anio, desde.mes - 1, desde.dia);

  while (actual <= fin) {
    const dia = new Date(actual);
    const clave = claveDeFecha({
      anio: dia.getUTCFullYear(),
      mes: dia.getUTCMonth() + 1,
      dia: dia.getUTCDate(),
    });

    if (!feriados.has(clave)) {
      const semana = dia.getUTCDay();
      if (semana >= 1 && semana <= 5) total += 1;
      else if (semana === 6) total += 0.5;
    }

    actual += 86_400_000;
  }

  return total;
}

/** El ultimo dia del mes de una fecha. */
export function finDeMes(fecha: FechaPlanilla): FechaPlanilla {
  const ultimo = new Date(Date.UTC(fecha.anio, fecha.mes, 0));
  return { anio: fecha.anio, mes: fecha.mes, dia: ultimo.getUTCDate() };
}

/* ------------------------------------------------------------------ */
/* Hoja CONFIG                                                         */
/* ------------------------------------------------------------------ */

/** Objetivos de un mes: el global y el de cada vendedor. */
export interface ObjetivosDelMes {
  global: number;
  porVendedor: Record<string, number>;
}

export interface ConfiguracionPlanilla {
  /** La «Fecha Actual (Corte)» que define quien mantiene el informe. */
  corte: FechaPlanilla | null;
  diasMes: number;
  diasTranscurridos: number;
  /** Objetivos del mes de corte. */
  objetivos: ObjetivosDelMes;
  /** Canal fijo por vendedor, cuando esta cargado en la columna K. */
  canalPorVendedor: Record<string, string>;
  /** Objetivos de meses cerrados, si el informe los archivo. */
  historico: Record<string, ObjetivosDelMes>;
}

/**
 * Lee la hoja `CONFIG`.
 *
 * Las posiciones son las que arma el propio Apps Script: el corte y los
 * dias habiles en la columna A/B, los feriados en la C, el objetivo
 * global en la D, y los objetivos por vendedor en la I y la J.
 */
export function leerConfiguracion(filas: string[][]): ConfiguracionPlanilla {
  let corte: FechaPlanilla | null = null;
  let global = 0;
  const porVendedor: Record<string, number> = {};
  const canalPorVendedor: Record<string, string> = {};
  const feriados = new Set<string>();
  const trozosHistorico: { orden: number; texto: string }[] = [];

  for (let indice = 0; indice < filas.length; indice += 1) {
    const fila = filas[indice];
    const etiqueta = (fila[0] ?? "").trim();

    if (etiqueta.includes("Fecha Actual (Corte)")) {
      corte = aFecha(fila[1]);
    }

    // Los objetivos de meses cerrados viajan en base64 partido en trozos,
    // porque una celda de Google Sheets no aguanta el JSON entero.
    if (etiqueta.startsWith("HISTORICO_B64_")) {
      trozosHistorico.push({
        orden: Number(etiqueta.replace("HISTORICO_B64_", "")) || 0,
        texto: (fila[1] ?? "").trim(),
      });
    }

    const feriado = aFecha(fila[2]);
    if (feriado) feriados.add(claveDeFecha(feriado));

    if (indice === 3 && fila[3]) global = aNumero(fila[3]);

    const vendedor = (fila[8] ?? "").trim();
    if (indice >= 3 && vendedor && vendedor !== "Vendedor") {
      const clave = limpiarNombre(vendedor);
      const meta = aNumero(fila[9]);
      if (meta > 0) porVendedor[clave] = meta;

      const canal = (fila[10] ?? "").trim();
      if (canal) canalPorVendedor[clave] = canalReal("", canal);
      if (clave.includes("BARBARA") && clave.includes("CASCO")) {
        canalPorVendedor[clave] = "Mayoristas";
      }
    }
  }

  // Los dias habiles se cuentan aca y no se leen de B6/B7. Esas celdas
  // tienen una funcion personalizada de Apps Script y el CSV publicado a
  // veces las entrega vacias; con el corte y los feriados alcanza.
  let diasMes = 0;
  let diasTranscurridos = 0;
  if (corte) {
    const inicio: FechaPlanilla = { anio: corte.anio, mes: corte.mes, dia: 1 };
    diasMes = diasHabiles(inicio, finDeMes(corte), feriados);
    diasTranscurridos = diasHabiles(inicio, corte, feriados);
  }

  return {
    corte,
    diasMes,
    diasTranscurridos,
    objetivos: { global, porVendedor },
    canalPorVendedor,
    historico: decodificarHistorico(trozosHistorico),
  };
}

function decodificarHistorico(
  trozos: { orden: number; texto: string }[],
): Record<string, ObjetivosDelMes> {
  if (trozos.length === 0) return {};

  try {
    const base64 = trozos
      .sort((a, b) => a.orden - b.orden)
      .map((t) => t.texto)
      .join("");
    const crudo = JSON.parse(Buffer.from(base64, "base64").toString("utf8")) as Record<
      string,
      { global?: number; vendedoresTotales?: Record<string, number> }
    >;

    const salida: Record<string, ObjetivosDelMes> = {};
    Object.entries(crudo).forEach(([mes, datos]) => {
      const porVendedor: Record<string, number> = {};
      Object.entries(datos.vendedoresTotales ?? {}).forEach(([vendedor, meta]) => {
        const valor = Number(meta);
        if (valor > 0) porVendedor[limpiarNombre(vendedor)] = valor;
      });
      salida[String(Number(mes))] = { global: Number(datos.global) || 0, porVendedor };
    });
    return salida;
  } catch {
    // Un historico ilegible no puede voltear la pantalla: el mes en curso
    // —que es lo que el comercial viene a ver— no depende de esto.
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* Hoja DATA                                                           */
/* ------------------------------------------------------------------ */

/** Lo que se acumula de un vendedor en un mes. */
export interface AcumuladoDelMes {
  vendedor: string;
  anio: number;
  mes: number;
  /** Suma de `TOTAL GS`: ya viene neta de notas de credito. */
  venta: number;
  /** Solo las notas de credito, para poder explicar una caida. */
  devoluciones: number;
  /** Cuanto vendio en cada canal, para saber cual es el suyo. */
  porCanal: Record<string, number>;
}

/** Donde esta cada columna que hace falta de la hoja `DATA`. */
interface Columnas {
  fecha: number;
  anio: number;
  mes: number;
  documento: number;
  vendedor: number;
  canal: number;
  total: number;
}

/**
 * Ubica las columnas por el nombre del encabezado.
 *
 * Por nombre y no por posicion fija porque el Apps Script ya agrego
 * columnas al final mas de una vez (rotacion, anticipos). Si se buscara
 * `r[30]` a ciegas, el dia que agreguen una columna en el medio la
 * pantalla mostraria otra cosa sin avisar.
 */
function ubicarColumnas(encabezado: string[]): Columnas | null {
  const indice = (...nombres: string[]): number =>
    encabezado.findIndex((celda) => nombres.includes(normalizar(celda)));

  const columnas: Columnas = {
    fecha: indice("FECHA"),
    anio: indice("ANO"),
    mes: indice("MES"),
    documento: indice("DOCUMENTO"),
    vendedor: indice("VENDEDOR"),
    canal: indice("EQUIPO/CANAL", "EQUIPO / CANAL"),
    total: indice("TOTAL GS"),
  };

  // Sin vendedor o sin importe no hay nada que mostrar, y mostrar cero
  // seria peor que decir que fallo.
  if (columnas.vendedor === -1 || columnas.total === -1) return null;
  return columnas;
}

/**
 * Suma la hoja `DATA` por vendedor y por mes.
 *
 * Devuelve `null` si no se reconoce el encabezado. Un CSV que llega
 * truncado o una pagina de error de Google no tienen que terminar en una
 * pantalla que dice «vendiste cero».
 */
export function acumularVentas(filas: string[][]): AcumuladoDelMes[] | null {
  if (filas.length < 2) return null;

  const columnas = ubicarColumnas(filas[0]);
  if (!columnas) return null;

  const acumulado = new Map<string, AcumuladoDelMes>();

  for (let i = 1; i < filas.length; i += 1) {
    const fila = filas[i];
    if (!fila || fila.length <= columnas.total) continue;

    const vendedorCrudo = fila[columnas.vendedor] ?? "";
    if (!vendedorSeCuenta(vendedorCrudo)) continue;

    const fecha = aFecha(fila[columnas.fecha]);
    const anio = fecha?.anio ?? (columnas.anio >= 0 ? aNumero(fila[columnas.anio]) : 0);
    const mes = fecha?.mes ?? (columnas.mes >= 0 ? aNumero(fila[columnas.mes]) : 0);
    if (!anio || !mes || mes < 1 || mes > 12) continue;

    const vendedor = limpiarNombre(vendedorCrudo);
    const clave = `${vendedor}|${anio}|${mes}`;
    let registro = acumulado.get(clave);
    if (!registro) {
      registro = { vendedor, anio, mes, venta: 0, devoluciones: 0, porCanal: {} };
      acumulado.set(clave, registro);
    }

    const monto = aNumero(fila[columnas.total]);
    registro.venta += monto;

    const documento = columnas.documento >= 0 ? normalizar(fila[columnas.documento]) : "";
    if (documento === "NOTA DE CREDITO") registro.devoluciones += monto;

    const canal = canalReal(vendedorCrudo, columnas.canal >= 0 ? (fila[columnas.canal] ?? "") : "");
    registro.porCanal[canal] = (registro.porCanal[canal] ?? 0) + monto;
  }

  return Array.from(acumulado.values());
}

/** El canal donde mas facturo, que es el que le corresponde mostrar. */
export function canalDominante(porCanal: Record<string, number>): string {
  let mejor = "";
  let maximo = -Infinity;
  Object.entries(porCanal).forEach(([canal, monto]) => {
    if (monto > maximo) {
      maximo = monto;
      mejor = canal;
    }
  });
  return mejor;
}
