import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
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
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFechaHora, formatearGuaranies } from "@/lib/formato";
import { leerResumenDeVentas } from "@/lib/ventas-servidor";
import {
  alcance,
  CLASES_NIVEL_ALCANCE,
  ETIQUETAS_NIVEL_ALCANCE,
  filasDelVendedor,
  nivelDeAlcance,
  nombreDeMes,
} from "@/lib/ventas";

export const metadata: Metadata = { title: "Mis ventas" };
export const dynamic = "force-dynamic";

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
 */
export default async function PaginaMisVentas() {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("vendedor_planilla")
    .eq("id", usuario.id)
    .maybeSingle();

  const nombreEnPlanilla =
    (perfil as { vendedor_planilla: string | null } | null)?.vendedor_planilla ?? null;

  if (!nombreEnPlanilla) {
    return (
      <div className="mx-auto max-w-3xl">
        <EncabezadoPagina titulo="Mis ventas" />
        <EstadoVacio
          icono={<TrendingUp className="size-6" />}
          titulo="Todavía no está vinculado al informe de ventas"
          descripcion="Esta pantalla muestra su avance contra el objetivo del mes. Para que aparezca, el Administrador SGC tiene que indicar con qué nombre figura usted en el informe comercial."
        />
      </div>
    );
  }

  const lectura = await leerResumenDeVentas();

  if (!lectura.ok) {
    return (
      <div className="mx-auto max-w-3xl">
        <EncabezadoPagina titulo="Mis ventas" />
        <EstadoVacio
          icono={<TrendingUp className="size-6" />}
          titulo={
            lectura.motivo === "sin_configurar"
              ? "El informe de ventas todavía no está conectado"
              : "No se pudo leer el informe de ventas"
          }
          descripcion={
            lectura.motivo === "sin_configurar"
              ? "Falta terminar la conexión con el informe comercial. Avise a TI."
              : "El informe no respondió. Vuelva a intentar en unos minutos; si sigue igual, avise a TI."
          }
        />
      </div>
    );
  }

  const { resumen } = lectura;
  const mias = filasDelVendedor(resumen, nombreEnPlanilla);

  const enCurso =
    mias.find((f) => f.mes === resumen.mesEnCurso && f.anio === resumen.anioEnCurso) ?? mias[0];

  const anteriores = mias.filter((f) => f !== enCurso);

  return (
    <div className="mx-auto max-w-4xl">
      <EncabezadoPagina
        titulo="Mis ventas"
        descripcion="Su avance contra el objetivo, con los mismos números del informe comercial."
      />

      {!enCurso ? (
        <EstadoVacio
          icono={<TrendingUp className="size-6" />}
          titulo="Todavía no hay movimientos suyos este mes"
          descripcion={`El informe no trae filas a nombre de «${nombreEnPlanilla}». Si cree que es un error, avise a TI.`}
        />
      ) : (
        <>
          <AvanceDelMes
            fila={enCurso}
            diasMes={resumen.diasMes}
            diasTranscurridos={resumen.diasTranscurridos}
          />

          {anteriores.length > 0 ? (
            <section className="mt-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-atenuado-contraste">
                Meses anteriores
              </h2>
              <Tarjeta>
                <Tabla>
                  <TablaCabecera>
                    <TablaFila>
                      <TablaEncabezado>Mes</TablaEncabezado>
                      <TablaEncabezado className="text-right">Objetivo</TablaEncabezado>
                      <TablaEncabezado className="text-right">Vendido</TablaEncabezado>
                      <TablaEncabezado className="text-right">Devoluciones</TablaEncabezado>
                      <TablaEncabezado className="text-right">Alcance</TablaEncabezado>
                      <TablaEncabezado>Estado</TablaEncabezado>
                    </TablaFila>
                  </TablaCabecera>
                  <TablaCuerpo>
                    {anteriores.map((fila) => {
                      const porcentaje = alcance(fila.meta, fila.venta);
                      const nivel = nivelDeAlcance(porcentaje);
                      return (
                        <TablaFila key={`${fila.anio}-${fila.mes}`}>
                          <TablaCelda className="whitespace-nowrap text-xs">
                            {nombreDeMes(fila.mes)} {fila.anio}
                          </TablaCelda>
                          <TablaCelda className="whitespace-nowrap text-right text-xs tabular">
                            {fila.meta === null ? "—" : formatearGuaranies(fila.meta)}
                          </TablaCelda>
                          <TablaCelda className="whitespace-nowrap text-right text-xs tabular">
                            {fila.venta === null ? "—" : formatearGuaranies(fila.venta)}
                          </TablaCelda>
                          <TablaCelda className="whitespace-nowrap text-right text-xs tabular text-atenuado-contraste">
                            {fila.devoluciones === 0
                              ? "—"
                              : formatearGuaranies(fila.devoluciones)}
                          </TablaCelda>
                          <TablaCelda
                            className={`whitespace-nowrap text-right text-xs font-semibold tabular ${CLASES_NIVEL_ALCANCE[nivel]}`}
                          >
                            {porcentaje === null ? "—" : `${Math.round(porcentaje)}%`}
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
            </section>
          ) : null}

          {/* Por que un mes cerrado puede no tener objetivo: el informe
              guarda los objetivos del mes en curso, y los de meses
              anteriores solo si se archivaron. Se dice en vez de reusar el
              objetivo de este mes, que daria un porcentaje falso. */}
          {anteriores.some((f) => f.meta === null) ? (
            <p className="mt-3 text-[11px] leading-relaxed text-atenuado-contraste">
              Los meses sin objetivo son los que el informe comercial no archivó: quedan con lo
              vendido, sin porcentaje.
            </p>
          ) : null}

          {/* De cuando es el dato. Sin esto, alguien puede tomar una
              decision creyendo que mira el minuto a minuto. */}
          <p className="mt-4 text-[11px] leading-relaxed text-atenuado-contraste">
            Datos del informe comercial, actualizados al{" "}
            {formatearFechaHora(resumen.actualizado)}. El detalle completo, con el desglose por
            marca y por producto, está en{" "}
            <Link href="/aplicaciones" className="text-primario hover:underline">
              Aplicaciones
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
