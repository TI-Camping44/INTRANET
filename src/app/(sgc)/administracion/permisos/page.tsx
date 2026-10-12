import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { MatrizPermisos } from "@/app/(sgc)/administracion/permisos/matriz-permisos";
import { Aviso, AvisoDescripcion, AvisoTitulo } from "@/components/ui/aviso";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { esClaveDeModulo, ROL_SIEMPRE_COMPLETO, type PermisoDeModulo } from "@/lib/permisos";
import { ETIQUETAS_ROL } from "@/lib/constantes";
import type { RolUsuario } from "@/lib/tipos";

export const metadata: Metadata = { title: "Permisos por rol" };
export const dynamic = "force-dynamic";

/**
 * Los roles que se configuran, en orden de alcance.
 *
 * El Administrador SGC NO está acá: su piso vive en `puede_ver()` y
 * `puede_editar()` de la base. Igual se muestra, en una pestaña que no
 * se puede tocar: que faltara se leía como un olvido, y lo que hay que
 * poder ver es justamente que lo tiene todo y que nadie se lo saca.
 */
const ROLES_EDITABLES: RolUsuario[] = [
  "direccion",
  "responsable_proceso",
  "auditor",
  "vendedor",
  "colaborador",
];

export default async function PaginaPermisos() {
  await requerirRol(["administrador_sgc"]);
  const supabase = crearClienteServidor();

  const { data } = await supabase.from("permisos").select("rol, modulo, ver, editar");

  const matrices: Record<string, Record<string, PermisoDeModulo>> = {};
  for (const rol of ROLES_EDITABLES) matrices[rol] = {};

  for (const fila of (data ?? []) as {
    rol: string;
    modulo: string;
    ver: boolean;
    editar: boolean;
  }[]) {
    if (matrices[fila.rol] && esClaveDeModulo(fila.modulo)) {
      matrices[fila.rol][fila.modulo] = { ver: fila.ver, editar: fila.editar };
    }
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Permisos por rol"
        descripcion="Qué módulos ve y cuáles puede editar cada rol. Se aplica a todas las personas con ese rol."
      />

      {/* POR QUÉ ESTO NO ES SOLO EL MENÚ. Es la pregunta que va a
          hacerse quien entre acá, y conviene que esté contestada en la
          pantalla y no solo en el código. */}
      <Aviso className="mb-5">
        <AvisoTitulo>Esto cierra la puerta, no solo la esconde</AvisoTitulo>
        <AvisoDescripcion>
          Lo que se desmarca acá desaparece del menú <strong>y</strong> deja de poder leerse
          desde la base de datos. Quien escriba la dirección a mano va a entrar a una pantalla
          sin datos. El {ETIQUETAS_ROL[ROL_SIEMPRE_COMPLETO]} conserva todos los módulos y no
          se puede configurar: es lo que garantiza que siempre quede alguien capaz de entrar a
          corregir esta pantalla.
        </AvisoDescripcion>
      </Aviso>

      <MatrizPermisos roles={ROLES_EDITABLES} matrices={matrices} />

      <Aviso className="mt-5">
        <AvisoDescripcion>
          Dos módulos no se cierran del todo desde acá. <strong>Usuarios y roles</strong> se
          saca del menú y de la pantalla, pero la tabla de personas la lee todo el sistema para
          mostrar quién cargó cada cosa, así que los nombres siguen estando a la vista donde ya
          aparecían. Y el <strong>Panel de calidad</strong> resume lo que hay en los otros
          módulos: lo que muestre depende de lo que la persona pueda ver en cada uno.
        </AvisoDescripcion>
      </Aviso>
    </>
  );
}
