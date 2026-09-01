import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FilaUsuario } from "@/app/(sgc)/administracion/usuarios/fila-usuario";
import { Aviso, AvisoDescripcion, AvisoTitulo } from "@/components/ui/aviso";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  Tabla,
  TablaCabecera,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { DESCRIPCION_ROL, DOMINIO_AUTORIZADO, ETIQUETAS_ROL } from "@/lib/constantes";
import type { RolUsuario } from "@/lib/tipos";

export const metadata: Metadata = { title: "Usuarios y roles" };
export const dynamic = "force-dynamic";

export default async function PaginaUsuarios() {
  await requerirRol(["administrador_sgc"]);
  const supabase = crearClienteServidor();

  const [{ data: usuarios }, { data: procesos }, { data: puestos }] = await Promise.all([
    supabase
      .from("usuarios")
      .select(
        "id, nombre_completo, correo, rol, superior_id, proceso_id, puesto_id, activo, ultimo_ingreso",
      )
      .order("nombre_completo"),
    supabase.from("procesos").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("puestos").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  const lista = (usuarios ?? []) as any[];

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios y roles"
        descripcion={`El perfil se crea solo en el primer ingreso con Google. Aquí se asigna el rol, el líder inmediato y el proceso a cargo.`}
      />

      <Aviso className="mb-4">
        <div>
          <AvisoTitulo>Cómo se dan de alta los usuarios</AvisoTitulo>
          <AvisoDescripcion>
            Cualquier cuenta del dominio {DOMINIO_AUTORIZADO} puede ingresar; el sistema crea su
            perfil con rol Colaborador. Desde esta pantalla se ajusta el rol y se define el jefe
            inmediato, que es a quien escala una acción correctiva vencida.
          </AvisoDescripcion>
        </div>
      </Aviso>

      <Tarjeta className="mb-4 p-4">
        <p className="mb-2 text-xs font-semibold">Roles del sistema</p>
        <dl className="grid gap-2 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(ETIQUETAS_ROL) as RolUsuario[]).map((rol) => (
            <div key={rol}>
              <dt className="font-medium">{ETIQUETAS_ROL[rol]}</dt>
              <dd className="text-atenuado-contraste">{DESCRIPCION_ROL[rol]}</dd>
            </div>
          ))}
        </dl>
      </Tarjeta>

      <Tarjeta>
        <Tabla>
          <TablaCabecera>
            <TablaFila>
              <TablaEncabezado className="w-[16rem]">Persona</TablaEncabezado>
              <TablaEncabezado colSpan={6}>
                Rol · Líder inmediato · Proceso · Puesto · Estado
              </TablaEncabezado>
            </TablaFila>
          </TablaCabecera>
          <TablaCuerpo>
            {lista.map((usuario) => (
              <FilaUsuario
                key={usuario.id}
                usuario={usuario}
                personas={lista.map((persona) => ({
                  id: persona.id,
                  nombre_completo: persona.nombre_completo,
                }))}
                procesos={(procesos ?? []) as { id: string; nombre: string }[]}
                puestos={(puestos ?? []) as { id: string; nombre: string }[]}
              />
            ))}
          </TablaCuerpo>
        </Tabla>
      </Tarjeta>

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {lista.length} usuario{lista.length === 1 ? "" : "s"} registrados.
      </p>
    </>
  );
}
