import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Aviso, AvisoDescripcion, AvisoTitulo } from "@/components/ui/aviso";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { FormularioUsuario } from "@/app/(sgc)/administracion/usuarios/[id]/formulario-usuario";
import { MatrizPermisos } from "@/app/(sgc)/administracion/permisos/matriz-permisos";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha, formatearFechaHora } from "@/lib/formato";
import { esClaveDeModulo, rolConPisoCompleto, type PermisoDeModulo } from "@/lib/permisos";
import { ETIQUETAS_ROL } from "@/lib/constantes";
import type { RolUsuario } from "@/lib/tipos";

export const metadata: Metadata = { title: "Ficha del usuario" };
export const dynamic = "force-dynamic";

/**
 * La ficha de una persona: todo lo que se le configura, y lo que termina
 * viendo por el rol que tiene.
 *
 * POR QUÉ UNA PANTALLA APARTE DE LA FILA. La fila del listado alcanza
 * para el ajuste rápido, pero no para contestar la pregunta que se hace
 * quien entra acá: «¿qué ve esta persona?». Eso son veintiún módulos por
 * dos casillas y no entra en una fila.
 *
 * LOS PERMISOS SON DEL ROL, NO DE LA PERSONA, y la pantalla lo dice en
 * vez de disimularlo. La matriz se edita desde acá —es la misma tabla y
 * la misma acción que en Permisos por rol, no hay una segunda copia— pero
 * arriba figura a cuánta gente más le cambia. Un permiso por persona
 * sería otra tabla y otra conversación: con 49 usuarios, lo que mantiene
 * esto explicable en una auditoría es que el rol diga todo.
 */
export default async function PaginaFichaUsuario({ params }: { params: { id: string } }) {
  await requerirRol(["administrador_sgc"]);
  const supabase = crearClienteServidor();

  const [
    { data: usuario },
    { data: todos },
    { data: procesos },
    { data: puestos },
    { data: datosVendedores },
    { data: filasPermisos },
  ] = await Promise.all([
    supabase
      .from("usuarios")
      .select(
        "id, nombre_completo, correo, rol, superior_id, proceso_id, puesto_id, " +
          "vendedor_planilla, ventas_canales, activo, ultimo_ingreso, creado_en, " +
          "telefono, fecha_ingreso",
      )
      .eq("id", params.id)
      .maybeSingle(),
    supabase.from("usuarios").select("id, nombre_completo, rol").order("nombre_completo"),
    supabase
      .from("procesos")
      .select("id, nombre")
      .eq("activo", true)
      .eq("version", "01")
      .order("nombre"),
    supabase.from("puestos").select("id, nombre").eq("activo", true).order("nombre"),
    supabase
      .from("ventas_mensuales")
      .select("vendedor")
      .not("vendedor", "is", null)
      .order("vendedor"),
    supabase.from("permisos").select("rol, modulo, ver, editar"),
  ]);

  if (!usuario) notFound();

  const ficha = usuario as unknown as {
    id: string;
    nombre_completo: string;
    correo: string;
    rol: RolUsuario;
    superior_id: string | null;
    proceso_id: string | null;
    puesto_id: string | null;
    vendedor_planilla: string | null;
    ventas_canales: string[] | null;
    activo: boolean;
    ultimo_ingreso: string | null;
    creado_en: string | null;
    telefono: string | null;
    fecha_ingreso: string | null;
  };

  const personas = (todos ?? []) as { id: string; nombre_completo: string; rol: string }[];

  // Se repiten por mes y por canal, así que se achican a los distintos.
  const vendedores = Array.from(
    new Set(
      ((datosVendedores ?? []) as { vendedor: string | null }[])
        .map((fila) => (fila.vendedor ?? "").trim())
        .filter((nombre) => nombre.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, "es"));

  const matriz: Record<string, PermisoDeModulo> = {};
  for (const fila of (filasPermisos ?? []) as {
    rol: string;
    modulo: string;
    ver: boolean;
    editar: boolean;
  }[]) {
    if (fila.rol === ficha.rol && esClaveDeModulo(fila.modulo)) {
      matriz[fila.modulo] = { ver: fila.ver, editar: fila.editar };
    }
  }

  const lider = ficha.superior_id
    ? personas.find((persona) => persona.id === ficha.superior_id)
    : null;

  // Cuánta gente más comparte el rol: es lo que hay que saber ANTES de
  // tocar la matriz de abajo.
  const mismoRol = personas.filter(
    (persona) => persona.rol === ficha.rol && persona.id !== ficha.id,
  ).length;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/administracion/usuarios"
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-atenuado-contraste hover:text-texto"
      >
        <ArrowLeft className="size-3.5" />
        Usuarios y roles
      </Link>

      <EncabezadoPagina
        titulo={ficha.nombre_completo}
        descripcion={ficha.correo}
        acciones={
          ficha.activo ? (
            <Insignia variante="exito">Activo</Insignia>
          ) : (
            <Insignia variante="atencion">Inactivo</Insignia>
          )
        }
      />

      {/* LO QUE NO SE EDITA ACÁ. El nombre y el correo los pone Google y
          la fecha de ingreso sale del padrón de Odoo: mostrarlos como
          campos daría a entender que se corrigen desde la intranet. */}
      <Tarjeta className="mb-4 p-4">
        <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-[11px] text-atenuado-contraste">Último ingreso</dt>
            <dd className="mt-0.5 font-medium">
              {ficha.ultimo_ingreso ? formatearFechaHora(ficha.ultimo_ingreso) : "Nunca ingresó"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-atenuado-contraste">Perfil creado</dt>
            <dd className="mt-0.5 font-medium">
              {ficha.creado_en ? formatearFecha(ficha.creado_en) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-atenuado-contraste">Ingreso a la empresa</dt>
            <dd className="mt-0.5 font-medium">
              {ficha.fecha_ingreso ? formatearFecha(ficha.fecha_ingreso) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-atenuado-contraste">Teléfono</dt>
            <dd className="mt-0.5 font-medium">{ficha.telefono ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-atenuado-contraste">Líder inmediato</dt>
            <dd className="mt-0.5 font-medium">{lider?.nombre_completo ?? "Sin jefe asignado"}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-atenuado-contraste">Rol</dt>
            <dd className="mt-0.5 font-medium">{ETIQUETAS_ROL[ficha.rol]}</dd>
          </div>
        </dl>
      </Tarjeta>

      <FormularioUsuario
        usuario={ficha}
        personas={personas.map(({ id, nombre_completo }) => ({ id, nombre_completo }))}
        procesos={(procesos ?? []) as { id: string; nombre: string }[]}
        puestos={(puestos ?? []) as { id: string; nombre: string }[]}
        vendedores={vendedores}
      />

      <h2 className="mb-2 mt-7 text-sm font-semibold">
        Qué ve y qué puede editar
      </h2>

      <Aviso className="mb-4">
        <div>
          <AvisoTitulo>
            {rolConPisoCompleto(ficha.rol)
              ? "El Administrador SGC conserva todos los módulos"
              : mismoRol === 0
                ? `Esto le cambia solo a ${ficha.nombre_completo.split(" ")[0]}`
                : `Esto le cambia a ${mismoRol + 1} personas`}
          </AvisoTitulo>
          <AvisoDescripcion>
            {rolConPisoCompleto(ficha.rol) ? (
              <>
                Su piso vive en la base de datos y no se puede quitar: es lo que garantiza que
                siempre quede alguien capaz de entrar a corregir los permisos.
              </>
            ) : (
              <>
                Los permisos son del rol <strong>{ETIQUETAS_ROL[ficha.rol]}</strong>, no de la
                persona.{" "}
                {mismoRol === 0
                  ? "Hoy nadie más lo tiene, pero lo que se marque acá va a regir para quien lo reciba después."
                  : `Hay ${mismoRol} persona${mismoRol === 1 ? "" : "s"} más con ese rol, y a esa gente le cambia igual.`}{" "}
                Si lo que hace falta es que esta persona vea algo distinta del resto de su rol,
                lo que corresponde es cambiarle el rol arriba. Es la misma matriz de{" "}
                <Link href="/administracion/permisos" className="underline underline-offset-2">
                  Permisos por rol
                </Link>
                : se edita desde los dos lados y es una sola.
              </>
            )}
          </AvisoDescripcion>
        </div>
      </Aviso>

      {/* Un solo rol: acá no hay pestañas que elegir, se mira el de esta
          persona. El componente es el mismo de Permisos por rol. */}
      <MatrizPermisos
        roles={[ficha.rol]}
        matrices={{ [ficha.rol]: matriz }}
        conSelector={false}
      />
    </div>
  );
}
