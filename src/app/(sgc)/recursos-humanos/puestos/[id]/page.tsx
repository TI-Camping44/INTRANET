import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Avatar, AvatarImagen, AvatarRespaldo } from "@/components/ui/avatar";
import { Boton } from "@/components/ui/boton";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { esAdministrador, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { iniciales } from "@/lib/utilidades";
import { FormularioPuesto } from "@/app/(sgc)/recursos-humanos/puestos/formulario-puesto";
import { PerfilesDelPuesto } from "@/app/(sgc)/recursos-humanos/puestos/[id]/perfiles-del-puesto";

export const dynamic = "force-dynamic";

interface PuestoDetalle {
  id: string;
  nombre: string;
  area: string | null;
  activo: boolean;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("puestos")
    .select("nombre")
    .eq("id", params.id)
    .maybeSingle();

  return { title: data ? (data as { nombre: string }).nombre : "Puesto" };
}

/**
 * La ficha del puesto.
 *
 * TRES COSAS Y NADA MÁS, como pidió Dirección el 5 de octubre: el
 * nombre, el departamento y el perfil en PDF. Salieron de acá el código,
 * el proceso, la misión, las funciones y los requisitos.
 *
 * La razón es la misma para todo lo que salió: el perfil de puesto es un
 * documento firmado y revisado, y transcribirlo a campos de la base
 * creaba una segunda versión que nadie mantenía y que a los seis meses
 * ya no decía lo mismo que el papel. El documento es la fuente; acá se
 * guarda y se abre.
 *
 * La matriz de competencias exigidas no se movió a otra pantalla: Calidad
 * resolvió que no la va a usar, así que se retiró del sistema.
 *
 * Quién está en el puesto sí se muestra: es lo que hace que los números
 * del listado —ocupados, vacantes— signifiquen algo, y acá se ve a quién
 * corresponden.
 */
export default async function PaginaPuesto({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const [{ data: consulta }, { data: ocupantes }, { data: archivos }] = await Promise.all([
    supabase.from("puestos").select("id, nombre, area, activo").eq("id", params.id).maybeSingle(),
    supabase
      .from("usuarios")
      .select("id, nombre_completo, correo, url_avatar")
      .eq("puesto_id", params.id)
      .eq("activo", true)
      .order("nombre_completo"),
    supabase
      .from("adjuntos")
      .select("id, nombre_archivo, tamano_bytes, descripcion, creado_en")
      .eq("entidad", "puestos")
      .eq("entidad_id", params.id)
      .order("creado_en", { ascending: false }),
  ]);

  const puesto = consulta as PuestoDetalle | null;
  if (!puesto) notFound();

  const personas =
    (ocupantes as
      | { id: string; nombre_completo: string; correo: string; url_avatar: string | null }[]
      | null) ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/recursos-humanos/puestos">
          <ArrowLeft /> Volver a los puestos
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={puesto.nombre}
        descripcion={puesto.area ?? undefined}
        acciones={esAdministrador(usuario) ? <FormularioPuesto puesto={puesto} /> : null}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <PerfilesDelPuesto
          puestoId={puesto.id}
          archivos={
            (archivos as
              | {
                  id: string;
                  nombre_archivo: string;
                  tamano_bytes: number;
                  descripcion: string | null;
                  creado_en: string;
                }[]
              | null) ?? []
          }
          puedeEditar={esAdministrador(usuario)}
        />

        <Tarjeta className="h-fit">
          <TarjetaCabecera>
            <TarjetaTitulo>
              En este puesto {personas.length > 0 ? `· ${personas.length}` : ""}
            </TarjetaTitulo>
          </TarjetaCabecera>
          <TarjetaContenido>
            {personas.length === 0 ? (
              <p className="text-xs leading-relaxed text-atenuado-contraste">
                Puesto vacante. Se asigna desde «Personas sin puesto», en el listado.
              </p>
            ) : (
              <ul className="space-y-2">
                {personas.map((persona) => (
                  <li key={persona.id} className="flex items-center gap-2">
                    <Avatar className="size-7 shrink-0">
                      {persona.url_avatar ? (
                        <AvatarImagen src={persona.url_avatar} alt="" />
                      ) : null}
                      <AvatarRespaldo className="text-[10px]">
                        {iniciales(persona.nombre_completo)}
                      </AvatarRespaldo>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">
                        {persona.nombre_completo}
                      </span>
                      <span className="block truncate text-[11px] text-atenuado-contraste">
                        {persona.correo}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TarjetaContenido>
        </Tarjeta>
      </div>
    </div>
  );
}
