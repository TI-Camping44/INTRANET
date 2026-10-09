import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  GraficoTendencia,
  type PuntoTendencia,
} from "@/components/comunes/grafico-tendencia";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import { AvanceDelMes } from "@/app/(sgc)/mis-ventas/avance-del-mes";
import { TablaEquipo } from "@/app/(sgc)/mis-ventas/tabla-equipo";
import { BotonSincronizar } from "@/app/(sgc)/mis-ventas/boton-sincronizar";
import { SelectorVendedor } from "@/app/(sgc)/mis-ventas/selector-vendedor";
import {
  CANALES_DE_VENTA,
  canalesVisiblesPara,
  esJefeDeVentas,
} from "@/lib/permisos-ventas";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFechaHora, formatearGuaranies } from "@/lib/formato";
import { leerResumenGuardado } from "@/lib/ventas-guardadas";
import {
  alcance,
  CLASES_NIVEL_ALCANCE,
  ETIQUETAS_NIVEL_ALCANCE,
  filasDelVendedor,
  nivelDeAlcance,
  nombreDeMes,
  type VentaDelMes,
} from "@/lib/ventas";

export const metadata: Metadata = { title: "Mis ventas" };
export const dynamic = "force-dynamic";

/** Un millón de guaraníes. El gráfico trabaja en esta unidad. */
const MILLON = 1_000_000;

/**
 * Como va el comercial contra su objetivo.
 *
 * CADA UNO VE LO SUYO. El resumen se pide entero al informe de ventas
 * —no hay forma de pedirle una sola fila— pero el filtrado pasa ACA, en
 * el servidor, contra el `vendedor_planilla` de quien esta conectado. Al
 * navegador solo viaja su propia fila: nunca las de los demas.
 *
 * Quien no tenga cargado su nombre en el informe no es comercial y la
 * pantalla se lo dice, en vez de mostrarle un vacio sin explicacion.
 *
 * ORDEN DE LA PANTALLA. Arriba las cuatro tarjetas del mes en curso, que
 * es a lo que entra; despues el mes a mes, que es la unica serie que
 * tiene sentido dibujar; al final el equipo, para quien supervisa. Un
 * jefe que ademas vende viene a ver primero lo suyo.
 */
export default async function PaginaMisVentas({
  searchParams,
}: {
  searchParams: { vendedor?: string };
}) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("vendedor_planilla, ventas_canales")
    .eq("id", usuario.id)
    .maybeSingle();

  const datos = perfil as {
    vendedor_planilla: string | null;
    ventas_canales: string[] | null;
  } | null;

  const nombreEnPlanilla = datos?.vendedor_planilla ?? null;

  // Los canales cuyo detalle puede ver. Vacio para casi todos; Direccion
  // los tiene todos sin configurar nada.
  const canalesVisibles = canalesVisiblesPara(
    usuario.rol,
    datos?.ventas_canales ?? null,
  );
  const esJefe = esJefeDeVentas(usuario.rol, datos?.ventas_canales ?? null);

  if (!nombreEnPlanilla && !esJefe) {
    return (
      <div className="mx-auto max-w-3xl">
        <EncabezadoPagina titulo="Mis ventas" />
        <EstadoVacio
          icono={<TrendingUp className="size-6" />}
          titulo="Todavía no está vinculado al informe de ventas"
          descripcion="Esta pantalla muestra su avance contra el objetivo del mes. Para que aparezca, el Administrador SGC tiene que indicar con qué nombre figura usted en el informe comercial, o qué canales puede supervisar."
        />
      </div>
    );
  }

  const lectura = await leerResumenGuardado(supabase);

  if (!lectura.ok) {
    return (
      <div className="mx-auto max-w-3xl">
        <EncabezadoPagina
          titulo="Mis ventas"
          acciones={
            usuario.rol === "administrador_sgc" ? <BotonSincronizar /> : null
          }
        />
        <EstadoVacio
          icono={<TrendingUp className="size-6" />}
          titulo={
            lectura.motivo === "sin_datos"
              ? "Todavía no se trajo ningún dato del informe"
              : "No se pudieron leer las ventas"
          }
          descripcion={
            lectura.motivo === "sin_datos"
              ? "El trabajo que lee la planilla comercial todavía no corrió. Avise a TI."
              : "Vuelva a intentar en unos minutos; si sigue igual, avise a TI."
          }
        />
      </div>
    );
  }

  const { resumen } = lectura;
  const mias = nombreEnPlanilla
    ? filasDelVendedor(resumen, nombreEnPlanilla)
    : [];

  // El equipo: el mes en curso de los canales que tiene asignados, sin su
  // propia fila, que ya esta arriba y con mas detalle.
  const equipo = resumen.filas.filter(
    (f) =>
      f.mes === resumen.mesEnCurso &&
      f.anio === resumen.anioEnCurso &&
      canalesVisibles.includes(f.canal as (typeof canalesVisibles)[number]) &&
      !mias.includes(f),
  );

  // DE QUIÉN SE MUESTRA EL DETALLE.
  //
  // Por omisión, lo propio. Un jefe puede pedir el de cualquiera de los
  // canales que supervisa con `?vendedor=`, y ESO SE VALIDA ACÁ: si el
  // código pedido no está entre los que puede ver, se ignora y se cae a
  // lo suyo. Sin esta comprobación, cambiar la dirección a mano dejaría
  // ver las ventas de cualquiera.
  const codsPermitidos = new Set(
    resumen.filas
      .filter((f) =>
        canalesVisibles.includes(f.canal as (typeof canalesVisibles)[number]),
      )
      .map((f) => f.cod),
  );

  const pedido = searchParams.vendedor?.trim() || null;
  const codElegido =
    pedido && codsPermitidos.has(pedido)
      ? pedido
      : pedido && mias.some((f) => f.cod === pedido)
        ? pedido
        : null;

  // Las filas del detalle: las del elegido, o las propias si no eligió.
  const detalle = codElegido
    ? resumen.filas
        .filter((f) => f.cod === codElegido)
        .sort((a, b) => b.anio - a.anio || b.mes - a.mes)
    : mias;

  // Quién es, para el título. El vendedor que mira lo suyo no necesita
  // que la pantalla le diga su propio nombre.
  const nombreDelDetalle =
    codElegido && !mias.some((f) => f.cod === codElegido)
      ? (detalle[0]?.vendedor ?? null)
      : null;

  // Las opciones del desplegable: una por persona, del mes en curso.
  const opciones = Array.from(
    new Map(
      resumen.filas
        .filter(
          (f) =>
            f.mes === resumen.mesEnCurso &&
            f.anio === resumen.anioEnCurso &&
            codsPermitidos.has(f.cod),
        )
        .map((f) => [
          f.cod,
          { cod: f.cod, nombre: f.vendedor, canal: f.canal },
        ]),
    ).values(),
  ).sort((a, b) => a.nombre.localeCompare(b.nombre));

  const enCurso =
    detalle.find(
      (f) => f.mes === resumen.mesEnCurso && f.anio === resumen.anioEnCurso,
    ) ?? detalle[0];

  // EL GRAFICO VA EN MILLONES. En guaraníes las marcas del eje serían
  // nueve dígitos y no se leen; la tabla de abajo lleva el monto exacto,
  // que es donde alguien va a buscar la cifra.
  const puntos: PuntoTendencia[] = [...detalle]
    .filter(
      (fila): fila is VentaDelMes & { venta: number } => fila.venta !== null,
    )
    .sort((a, b) => a.anio - b.anio || a.mes - b.mes)
    .map((fila) => ({
      periodo: `${fila.anio}-${String(fila.mes).padStart(2, "0")}-01`,
      valor: Math.round((fila.venta / MILLON) * 10) / 10,
      meta:
        fila.meta === null ? null : Math.round((fila.meta / MILLON) * 10) / 10,
      cumple: fila.meta === null ? null : fila.venta >= fila.meta,
    }));

  return (
    <div className="mx-auto max-w-6xl">
      <EncabezadoPagina
        titulo="Mis ventas"
        descripcion={
          nombreEnPlanilla
            ? "Su avance contra el objetivo, con los mismos números del informe comercial."
            : "Cómo va su equipo contra el objetivo, con los mismos números del informe comercial. Elija un vendedor para ver su detalle."
        }
        acciones={
          usuario.rol === "administrador_sgc" ? <BotonSincronizar /> : null
        }
      />

      {/* El desplegable, solo para quien supervisa. Elegir a alguien
          vuelve a armar la página entera con su detalle. */}
      {esJefe && opciones.length > 0 ? (
        <div className="mb-4">
          <SelectorVendedor opciones={opciones} elegido={codElegido} />
        </div>
      ) : null}

      {!enCurso && nombreEnPlanilla && !codElegido ? (
        <EstadoVacio
          icono={<TrendingUp className="size-6" />}
          titulo="Todavía no hay movimientos suyos este mes"
          descripcion={`El informe no trae filas a nombre de «${nombreEnPlanilla}». Si cree que es un error, avise a TI.`}
        />
      ) : null}

      {enCurso ? (
        <>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-atenuado-contraste">
            {nombreDelDetalle ? `${nombreDelDetalle} · ` : ""}
            {nombreDeMes(enCurso.mes)} {enCurso.anio} · {enCurso.canal}
          </p>

          <AvanceDelMes
            fila={enCurso}
            diasMes={resumen.diasMes}
            diasTranscurridos={resumen.diasTranscurridos}
          />

          {/* El mes a mes: la unica serie que esta pantalla dibuja. El
              grafico y su tabla van juntos, como en todo el SGC. Con un
              solo mes no hay tendencia que mostrar y queda la tabla. */}
          <section className="mt-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-atenuado-contraste">
              Mes a mes
            </h2>

            <Tarjeta>
              {puntos.length >= 2 ? (
                <div className="border-b border-borde p-4">
                  <GraficoTendencia
                    puntos={puntos}
                    unidad="millones de Gs."
                    altura={240}
                  />
                </div>
              ) : null}

              {/* `Tabla` ya trae su propio contenedor con desplazamiento
                  horizontal: envolverla otra vez daría dos barras. */}
              <Tabla>
                <TablaCabecera>
                  <TablaFila>
                    <TablaEncabezado>Mes</TablaEncabezado>
                    <TablaEncabezado className="text-right">
                      Objetivo
                    </TablaEncabezado>
                    <TablaEncabezado className="text-right">
                      Vendido
                    </TablaEncabezado>
                    <TablaEncabezado className="text-right">
                      Devoluciones
                    </TablaEncabezado>
                    <TablaEncabezado className="text-right">
                      Alcance
                    </TablaEncabezado>
                    <TablaEncabezado>Estado</TablaEncabezado>
                  </TablaFila>
                </TablaCabecera>
                <TablaCuerpo>
                  {detalle.map((fila) => {
                    const porcentaje = alcance(fila.meta, fila.venta);
                    const nivel = nivelDeAlcance(porcentaje);
                    const esElMes = fila === enCurso;

                    return (
                      <TablaFila
                        key={`${fila.anio}-${fila.mes}`}
                        className={esElMes ? "bg-acento/40" : undefined}
                      >
                        <TablaCelda className="whitespace-nowrap text-xs">
                          <span
                            className={esElMes ? "font-semibold" : undefined}
                          >
                            {nombreDeMes(fila.mes)} {fila.anio}
                          </span>
                          {esElMes ? (
                            <span className="ml-1.5 text-[11px] text-atenuado-contraste">
                              en curso
                            </span>
                          ) : null}
                        </TablaCelda>
                        <TablaCelda className="whitespace-nowrap text-right text-xs tabular">
                          {fila.meta === null
                            ? "—"
                            : formatearGuaranies(fila.meta)}
                        </TablaCelda>
                        <TablaCelda
                          className={`whitespace-nowrap text-right text-xs tabular ${
                            esElMes ? "font-semibold" : ""
                          }`}
                        >
                          {fila.venta === null
                            ? "—"
                            : formatearGuaranies(fila.venta)}
                        </TablaCelda>
                        <TablaCelda className="whitespace-nowrap text-right text-xs tabular text-atenuado-contraste">
                          {fila.devoluciones === 0
                            ? "—"
                            : formatearGuaranies(fila.devoluciones)}
                        </TablaCelda>
                        <TablaCelda
                          className={`whitespace-nowrap text-right text-xs font-semibold tabular ${CLASES_NIVEL_ALCANCE[nivel]}`}
                        >
                          {porcentaje === null
                            ? "—"
                            : `${Math.round(porcentaje)}%`}
                        </TablaCelda>
                        <TablaCelda>
                          <Insignia variante="contorno">
                            {ETIQUETAS_NIVEL_ALCANCE[nivel]}
                          </Insignia>
                        </TablaCelda>
                      </TablaFila>
                    );
                  })}
                </TablaCuerpo>
              </Tabla>
            </Tarjeta>

            {/* Por que un mes cerrado puede no tener objetivo: el informe
                guarda los objetivos del mes en curso, y los de meses
                anteriores solo si se archivaron. Se dice en vez de reusar
                el objetivo de este mes, que daria un porcentaje falso. */}
            {detalle.some((f) => f !== enCurso && f.meta === null) ? (
              <p className="mt-2 text-[11px] leading-relaxed text-atenuado-contraste">
                Los meses sin objetivo son los que el informe comercial no
                archivó: quedan con lo vendido, sin porcentaje.
              </p>
            ) : null}
          </section>
        </>
      ) : null}

      {/* El equipo, para quien tiene canales asignados. Va DESPUES de lo
          propio: un jefe que ademas vende viene a ver primero lo suyo. */}
      {esJefe ? (
        <section className="mt-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-atenuado-contraste">
            {nombreDeMes(resumen.mesEnCurso)} {resumen.anioEnCurso} ·{" "}
            {canalesVisibles.length === CANALES_DE_VENTA.length
              ? "Todos los canales"
              : canalesVisibles.join(" · ")}
          </h2>

          {equipo.length === 0 ? (
            <EstadoVacio
              icono={<TrendingUp className="size-6" />}
              titulo="Todavía no hay movimientos en estos canales"
              descripcion="El informe no trae ventas este mes para los canales que usted supervisa."
            />
          ) : (
            <TablaEquipo
              filas={equipo}
              diasMes={resumen.diasMes}
              diasTranscurridos={resumen.diasTranscurridos}
            />
          )}
        </section>
      ) : null}

      {/* De cuando es el dato. Sin esto, alguien puede tomar una
          decision creyendo que mira el minuto a minuto. */}
      <p className="mt-4 text-[11px] leading-relaxed text-atenuado-contraste">
        Datos del informe comercial, actualizados al{" "}
        {formatearFechaHora(resumen.actualizado)}. El detalle completo, con el
        desglose por marca y por producto, está en{" "}
        <Link href="/aplicaciones" className="text-primario hover:underline">
          Aplicaciones
        </Link>
        .
      </p>
    </div>
  );
}
