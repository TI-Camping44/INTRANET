import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { esAdministrador, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { FormularioPuesto } from "@/app/(sgc)/recursos-humanos/puestos/formulario-puesto";
import { PerfilesDelPuesto } from "@/app/(sgc)/recursos-humanos/puestos/[id]/perfiles-del-puesto";
import {
  PersonasDelPuesto,
  type PersonaEnPuesto,
} from "@/app/(sgc)/recursos-humanos/puestos/[id]/personas-del-puesto";

export const dynamic = "force-dynamic";

interface PuestoDetalle {
  id: string;
  nombre: string;
  area: string | null;
  activo: boolean;
  empresa_del_puesto_id: string | null;
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
 * el proceso, la misión, las funciones y los requisitos. Después se sumó
 * la empresa del grupo a la que corresponde el puesto, que son dos.
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
 * Quién está en el puesto sí se muestra, y se edita: es lo que hace que
 * los números del listado —ocupados, vacantes— signifiquen algo, y acá se
 * ve a quién corresponden. Una persona puede ocupar hasta dos puestos.
 */
export default async function PaginaPuesto({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();
  const administra = esAdministrador(usuario);

  const [{ data: consulta }, { data: todas }, { data: archivos }, { data: datosEmpresas }] =
    await Promise.all([
      supabase
        .from("puestos")
        .select("id, nombre, area, activo, empresa_del_puesto_id")
        .eq("id", params.id)
        .maybeSingle(),
      // Todas las personas activas, no solo las de este puesto: con la
      // misma consulta se arma quién lo ocupa y quién tiene lugar para
      // sumarse.
      supabase
        .from("usuarios")
        .select("id, nombre_completo, correo, url_avatar, puesto_id, puesto_secundario_id")
        .eq("activo", true)
        .order("nombre_completo"),
      supabase
        .from("adjuntos")
        .select("id, nombre_archivo, tamano_bytes, descripcion, creado_en")
        .eq("entidad", "puestos")
        .eq("entidad_id", params.id)
        .order("creado_en", { ascending: false }),
      supabase.rpc("empresas_del_grupo"),
    ]);

  const puesto = consulta as PuestoDetalle | null;
  if (!puesto) notFound();

  const empresas = (datosEmpresas as { id: string; nombre: string }[] | null) ?? [];
  const empresaDelPuesto = puesto.empresa_del_puesto_id
    ? empresas.find((empresa) => empresa.id === puesto.empresa_del_puesto_id)?.nombre
    : null;

  const gente =
    (todas as
      | {
          id: string;
          nombre_completo: string;
          correo: string;
          url_avatar: string | null;
          puesto_id: string | null;
          puesto_secundario_id: string | null;
        }[]
      | null) ?? [];

  const personas: PersonaEnPuesto[] = gente
    .filter(
      (persona) =>
        persona.puesto_id === puesto.id || persona.puesto_secundario_id === puesto.id,
    )
    .map((persona) => ({
      id: persona.id,
      nombre_completo: persona.nombre_completo,
      correo: persona.correo,
      url_avatar: persona.url_avatar,
      esPrincipal: persona.puesto_id === puesto.id,
    }));

  // Quien tiene lugar: no está ya en este puesto y no ocupa los dos que
  // permite la tabla.
  const disponibles = gente
    .filter(
      (persona) =>
        persona.puesto_id !== puesto.id &&
        persona.puesto_secundario_id !== puesto.id &&
        !(persona.puesto_id && persona.puesto_secundario_id),
    )
    .map((persona) => ({
      id: persona.id,
      nombre_completo: persona.nombre_completo,
      cuantosPuestos: persona.puesto_id ? 1 : 0,
    }));

  const descripcion = [empresaDelPuesto, puesto.area].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-4xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/recursos-humanos/puestos">
          <ArrowLeft /> Volver a los puestos
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={puesto.nombre}
        descripcion={descripcion || undefined}
        acciones={administra ? <FormularioPuesto puesto={puesto} empresas={empresas} /> : null}
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
          puedeEditar={administra}
        />

        <Tarjeta className="h-fit">
          <TarjetaCabecera>
            <TarjetaTitulo>
              En este puesto {personas.length > 0 ? `· ${personas.length}` : ""}
            </TarjetaTitulo>
          </TarjetaCabecera>
          <TarjetaContenido>
            <PersonasDelPuesto
              puestoId={puesto.id}
              personas={personas}
              disponibles={disponibles}
              puedeAsignar={administra}
            />
          </TarjetaContenido>
        </Tarjeta>
      </div>
    </div>
  );
}
