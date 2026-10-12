import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { ListaAplicaciones } from "@/app/(sgc)/aplicaciones/administrar/lista-aplicaciones";
import { Aviso, AvisoDescripcion, AvisoTitulo } from "@/components/ui/aviso";
import { Boton } from "@/components/ui/boton";
import { requerirModuloEditable } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Aplicacion } from "@/lib/aplicaciones";

export const metadata: Metadata = { title: "Administrar aplicaciones" };
export const dynamic = "force-dynamic";

/**
 * La lista de aplicaciones: qué hay y quién ve cada una.
 *
 * Vive adentro del módulo y no en Configuraciones porque es la lista de
 * Aplicaciones, no una pantalla aparte: quien la administra llega desde
 * la pantalla que está mirando. El permiso sale de «editar» del módulo
 * `aplicaciones`, el mismo lugar que todo lo demás del sistema.
 */
export default async function PaginaAdministrarAplicaciones() {
  await requerirModuloEditable("aplicaciones");
  const supabase = crearClienteServidor();

  const { data } = await supabase
    .from("aplicaciones")
    .select("id, nombre, descripcion, url, publico, orden, roles_visibles")
    .order("publico")
    .order("orden");

  const aplicaciones = (data as unknown as Aplicacion[] | null) ?? [];

  return (
    <>
      <EncabezadoPagina
        titulo="Administrar aplicaciones"
        descripcion="Qué aplicaciones se enlazan desde la intranet y a qué roles se les muestra."
        acciones={
          <Boton variante="contorno" comoHijo>
            <Link href="/aplicaciones">
              <ArrowLeft /> Volver a Aplicaciones
            </Link>
          </Boton>
        }
      />

      {/* ESTO ORDENA LA PANTALLA; NO CIERRA LA APLICACIÓN. Es la
          pregunta que se va a hacer quien entre acá, y conviene que esté
          contestada en la pantalla y no solo en el código: los tableros
          de GitHub Pages son páginas públicas en Internet. */}
      <Aviso className="mb-5">
        <AvisoTitulo>Esto decide quién la ve en la intranet, no quién puede abrirla</AvisoTitulo>
        <AvisoDescripcion>
          Destildar un rol le saca la tarjeta <strong>y</strong> hace que la base deje de
          devolverle la fila: no se entera de que la aplicación existe. Pero los catálogos y
          tableros publicados en GitHub Pages son páginas abiertas en Internet, así que quien
          ya tenga el enlace guardado entra igual, con sesión o sin ella. Los formularios de
          Apps Script sí exigen cuenta del dominio. Para cerrar un tablero de verdad hay que
          hacerlo del lado de GitHub Pages.
        </AvisoDescripcion>
      </Aviso>

      <ListaAplicaciones aplicaciones={aplicaciones} />
    </>
  );
}
