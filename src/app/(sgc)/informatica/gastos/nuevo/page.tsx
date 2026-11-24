import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioGasto } from "@/app/(sgc)/informatica/gastos/formulario-gasto";
import { datosDelFormularioDeGasto } from "@/app/(sgc)/informatica/gastos/datos-formulario";
import { requerirModuloEditable } from "@/lib/sesion";
import { hoyEnAsuncion } from "@/lib/formato";

export const metadata: Metadata = { title: "Registrar gasto de TI" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevoGasto() {
  const usuario = await requerirModuloEditable("informatica");
  const datos = await datosDelFormularioDeGasto();

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Registrar gasto de TI"
        descripcion="Una factura o un pago del área, en su moneda y con la empresa a la que se imputa."
      />
      <FormularioGasto {...datos} hoy={hoyEnAsuncion()} empresaPorOmision={usuario.empresa_id} />
    </div>
  );
}
