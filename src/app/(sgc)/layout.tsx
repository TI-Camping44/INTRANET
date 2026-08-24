import Link from "next/link";
import { Cabecera } from "@/components/comunes/cabecera";
import { LogotipoCompleto } from "@/components/comunes/logotipo";
import { NavegacionLateral } from "@/components/comunes/navegacion-lateral";
import { navegacionParaRol } from "@/lib/navegacion";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { NOMBRE_EMPRESA } from "@/lib/constantes";
import type { Notificacion } from "@/lib/tipos";

/** Estructura comun de todas las pantallas con sesion iniciada. */
export default async function SgcLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();
  const grupos = navegacionParaRol(usuario.rol);

  const [{ data: notificaciones }, { count: sinLeer }] = await Promise.all([
    supabase
      .from("notificaciones")
      .select("*")
      .eq("usuario_id", usuario.id)
      .order("creado_en", { ascending: false })
      .limit(12),
    supabase
      .from("notificaciones")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", usuario.id)
      .eq("leida", false),
  ]);

  return (
    <div className="min-h-dvh bg-fondo">
      {/* Menú lateral fijo en pantallas grandes. */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-borde
                   bg-tarjeta lg:flex"
      >
        <div className="flex h-14 shrink-0 items-center border-b border-borde px-4">
          <Link href="/panel">
            <LogotipoCompleto />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavegacionLateral grupos={grupos} />
        </div>
        <div className="border-t border-borde px-4 py-3">
          <p className="text-[10px] leading-relaxed text-atenuado-contraste">
            {NOMBRE_EMPRESA}
            <br />
            Sistema de Gestión de Calidad
          </p>
        </div>
      </aside>

      <div className="lg:pl-60">
        <Cabecera
          usuario={usuario}
          grupos={grupos}
          notificaciones={(notificaciones as Notificacion[] | null) ?? []}
          sinLeer={sinLeer ?? 0}
        />
        <main className="px-3 py-5 sm:px-5 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
