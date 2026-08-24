import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioPerfil } from "@/app/(sgc)/perfil/formulario-perfil";
import { Insignia } from "@/components/ui/insignia";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { DESCRIPCION_ROL, ETIQUETAS_ROL } from "@/lib/constantes";
import { formatearFechaHora } from "@/lib/formato";

export const metadata: Metadata = { title: "Mi perfil" };
export const dynamic = "force-dynamic";

export default async function PaginaPerfil() {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const [{ data: superior }, { data: proceso }, { data: puesto }] = await Promise.all([
    usuario.superior_id
      ? supabase
          .from("usuarios")
          .select("nombre_completo")
          .eq("id", usuario.superior_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    usuario.proceso_id
      ? supabase.from("procesos").select("nombre").eq("id", usuario.proceso_id).maybeSingle()
      : Promise.resolve({ data: null }),
    usuario.puesto_id
      ? supabase.from("puestos").select("nombre").eq("id", usuario.puesto_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <EncabezadoPagina
        titulo="Mi perfil"
        descripcion="El rol, el jefe inmediato y el proceso a cargo los define el Administrador SGC."
      />

      <div className="space-y-4">
        <Tarjeta>
          <TarjetaCabecera>
            <TarjetaTitulo>Datos personales</TarjetaTitulo>
          </TarjetaCabecera>
          <TarjetaContenido>
            <FormularioPerfil
              nombre={usuario.nombre_completo}
              telefono={usuario.telefono}
              correo={usuario.correo}
            />
          </TarjetaContenido>
        </Tarjeta>

        <Tarjeta>
          <TarjetaCabecera>
            <TarjetaTitulo>Rol y ubicación en la organización</TarjetaTitulo>
          </TarjetaCabecera>
          <TarjetaContenido>
            <div className="mb-3 flex items-center gap-2">
              <Insignia variante="primaria">{ETIQUETAS_ROL[usuario.rol]}</Insignia>
              <span className="text-[11px] text-atenuado-contraste">
                {DESCRIPCION_ROL[usuario.rol]}
              </span>
            </div>
            <dl className="space-y-2.5 text-xs">
              <Dato etiqueta="Puesto" valor={puesto?.nombre ?? "Sin puesto asignado"} />
              <Dato etiqueta="Proceso a cargo" valor={proceso?.nombre ?? "Sin proceso asignado"} />
              <Dato
                etiqueta="Jefe inmediato"
                valor={superior?.nombre_completo ?? "Sin jefe asignado"}
              />
              <Dato
                etiqueta="Último ingreso"
                valor={formatearFechaHora(usuario.ultimo_ingreso)}
              />
            </dl>
          </TarjetaContenido>
        </Tarjeta>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-atenuado-contraste">{etiqueta}</dt>
      <dd className="text-right font-medium">{valor}</dd>
    </div>
  );
}
