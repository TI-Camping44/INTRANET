"use client";

import { Printer } from "lucide-react";
import { Boton } from "@/components/ui/boton";

/**
 * «Generar PDF».
 *
 * NO SE ARMA EL ARCHIVO EN EL SERVIDOR: se abre el diálogo de impresión
 * del navegador, donde «Guardar como PDF» produce el archivo. El
 * proyecto no tiene librería de PDF y agregarla para esto significaba
 * posicionar cada línea a mano, con peor tipografía y un mantenimiento
 * aparte cada vez que la carta cambie una palabra.
 *
 * Lo que se imprime es esta misma página: lo que se ve en pantalla es
 * exactamente lo que sale en el archivo.
 */
export function BotonImprimir() {
  return (
    <Boton tamano="pequeno" onClick={() => window.print()} className="no-imprimir">
      <Printer /> Generar PDF
    </Boton>
  );
}
