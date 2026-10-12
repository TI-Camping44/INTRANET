import type { Metadata } from "next";

import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import {
  BotonInvitarAPendientes,
  BotonProbarCorreo,
} from "@/app/(sgc)/administracion/usuarios/invitar";
import { ListaUsuarios, type PersonaDeLaLista } from "@/app/(sgc)/administracion/usuarios/lista-usuarios";
import { FormularioPuesto } from "@/app/(sgc)/recursos-humanos/puestos/formulario-puesto";
import { Aviso, AvisoDescripcion, AvisoTitulo } from "@/components/ui/aviso";
import { Tarjeta } from "@/components/ui/tarjeta";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { DOMINIOS_AUTORIZADOS_TEXTO } from "@/lib/constantes";
import type { RolUsuario } from "@/lib/tipos";

export const metadata: Metadata = { title: "Usuarios" };
export const dynamic = "force-dynamic";

/**
 * La tanda de invitaciones manda hasta diez correos seguidos, cada uno
 * con su propio tiempo de espera. Con los diez segundos de por omisión se
 * cortaría a la mitad.
 */
export const maxDuration = 60;

/** Para comparar nombres de puesto sin que una tilde los separe. */
function normalizar(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

interface FilaNomina {
  id: string;
  correo: string;
  nombre_completo: string;
  cedula: string | null;
  puesto_nombre: string | null;
  gerente_nombre: string | null;
  empresa_del_puesto: string | null;
  fecha_ingreso: string | null;
  usuario_id: string | null;
  invitado_en: string | null;
  invitaciones_enviadas: number;
  puesto_manual_id: string | null;
  puesto_manual_fijado: boolean;
}

interface FilaUsuario {
  id: string;
  nombre_completo: string;
  correo: string;
  rol: RolUsuario;
  superior_id: string | null;
  puesto_id: string | null;
  activo: boolean;
  ultimo_ingreso: string | null;
}

/**
 * Usuarios: UNA SOLA PANTALLA para toda la gente.
 *
 * ESTABAN SEPARADAS Y NO TENÍA QUE ESTARLO. «Padrón de la nómina»
 * mostraba las 55 personas que pueden entrar y «Usuarios y roles» las 2
 * que entraron, y eran dos listas de la misma gente en dos lugares del
 * menú: quien iba a configurar a alguien tenía que saber de antemano en
 * cuál de las dos caía esa persona, que es justo lo que no se sabe.
 *
 * Ahora es una lista con las 55, y lo que cambia es la columna de la
 * derecha: quien no ingresó lleva el botón que lo invita, y quien ingresó
 * lleva a su ficha, donde se le configura todo.
 *
 * NO SE PUEDE UNIFICAR MÁS QUE ESTO, y conviene tenerlo claro: el perfil
 * de una persona no existe hasta su primer ingreso con Google —`usuarios`
 * depende de `auth.users`, que lo crea Google y no la intranet—, así que
 * a quien todavía no entró no hay rol ni permiso que asignarle. La
 * pantalla lo dice en vez de dejar un formulario muerto.
 *
 * LA LISTA ARRANCA DEL PADRÓN pero no se queda ahí: quien ingresó con una
 * cuenta del dominio y no figura en la exportación de Odoo igual aparece.
 * Si no, alguien real quedaría sin fila por un dato que falta en el ERP.
 */
export default async function PaginaUsuarios() {
  await requerirRol(["administrador_sgc"]);
  const supabase = crearClienteServidor();

  const [
    { data: nomina },
    { data: usuarios },
    { data: puestos },
    { data: datosEmpresas },
  ] = await Promise.all([
    supabase
      .from("personas_nomina")
      .select(
        "id, correo, nombre_completo, cedula, puesto_nombre, gerente_nombre," +
          " empresa_del_puesto, fecha_ingreso, usuario_id, invitado_en, invitaciones_enviadas",
      )
      .eq("activo", true)
      .order("nombre_completo"),
    supabase
      .from("usuarios")
      .select("id, nombre_completo, correo, rol, superior_id, puesto_id, activo, ultimo_ingreso")
      .order("nombre_completo"),
    supabase.from("puestos").select("id, nombre").eq("activo", true).order("nombre"),
    // Las empresas van por `empresas_del_grupo()` y no por un select a
    // `empresas`: esa tabla solo deja ver la propia, así que Vitálica
    // volvería vacía.
    supabase.rpc("empresas_del_grupo"),
  ]);

  const filasNomina = (nomina ?? []) as unknown as FilaNomina[];
  const filasUsuario = (usuarios ?? []) as unknown as FilaUsuario[];
  const listaPuestos = (puestos ?? []) as { id: string; nombre: string }[];
  const empresas = (datosEmpresas as { id: string; nombre: string }[] | null) ?? [];

  const usuarioPorId = new Map(filasUsuario.map((u) => [u.id, u]));
  const puestoPorId = new Map(listaPuestos.map((p) => [p.id, p.nombre]));
  const nombrePorUsuarioId = new Map(filasUsuario.map((u) => [u.id, u.nombre_completo]));

  // Qué puestos existen, para avisar cuál no va a poder asignarse.
  const puestosCargados = new Set(listaPuestos.map((p) => normalizar(p.nombre)));
  const idPorPuestoNormalizado = new Map(
    listaPuestos.map((p) => [normalizar(p.nombre), p.id] as const),
  );
  // Quiénes figuran en el padrón, para avisar qué líder no se va a poder
  // resolver: si el jefe no está, nadie le va a escalar una acción.
  const nombresDelPadron = new Set(filasNomina.map((f) => normalizar(f.nombre_completo)));

  const personas: PersonaDeLaLista[] = filasNomina.map((fila) => {
    const usuario = fila.usuario_id ? usuarioPorId.get(fila.usuario_id) : undefined;

    // EL PUESTO, POR PRECEDENCIA: el perfil de quien ya ingresó manda —ahí
    // es donde se edita—, después el ajuste a mano del padrón, y al final
    // el cargo de Odoo resuelto por nombre.
    const puestoId =
      usuario?.puesto_id ??
      (fila.puesto_manual_fijado
        ? fila.puesto_manual_id
        : (idPorPuestoNormalizado.get(normalizar(fila.puesto_nombre)) ?? null));

    return {
      clave: usuario ? `usuario:${usuario.id}` : `nomina:${fila.id}`,
      nominaId: fila.id,
      usuarioId: fila.usuario_id,
      nombre: usuario?.nombre_completo ?? fila.nombre_completo,
      correo: fila.correo,
      cedula: fila.cedula,
      puesto: puestoId ? (puestoPorId.get(puestoId) ?? null) : fila.puesto_nombre,
      puestoId,
      puestoDeOdoo: fila.puesto_nombre,
      puestoCorregido: fila.puesto_manual_fijado || usuario?.puesto_id != null,
      puestoResuelve:
        puestoId !== null ||
        (fila.puesto_nombre !== null && puestosCargados.has(normalizar(fila.puesto_nombre))),
      empresa: fila.empresa_del_puesto,
      lider: usuario?.superior_id
        ? (nombrePorUsuarioId.get(usuario.superior_id) ?? fila.gerente_nombre)
        : fila.gerente_nombre,
      liderResuelve:
        fila.gerente_nombre !== null && nombresDelPadron.has(normalizar(fila.gerente_nombre)),
      rol: usuario?.rol ?? null,
      activo: usuario?.activo ?? true,
      fechaIngreso: fila.fecha_ingreso,
      ultimoIngreso: usuario?.ultimo_ingreso ?? null,
      invitadoEn: fila.invitado_en,
      invitacionesEnviadas: fila.invitaciones_enviadas,
      enElPadron: true,
    };
  });

  // QUIEN ENTRÓ Y NO ESTÁ EN EL PADRÓN va igual. Es alguien real con
  // cuenta del dominio a quien la exportación de Odoo no trajo: dejarlo
  // afuera lo volvería imposible de configurar.
  const idsEnElPadron = new Set(filasNomina.map((f) => f.usuario_id).filter(Boolean));
  for (const usuario of filasUsuario) {
    if (idsEnElPadron.has(usuario.id)) continue;
    personas.push({
      clave: `usuario:${usuario.id}`,
      nominaId: null,
      usuarioId: usuario.id,
      nombre: usuario.nombre_completo,
      correo: usuario.correo,
      cedula: null,
      puesto: usuario.puesto_id ? (puestoPorId.get(usuario.puesto_id) ?? null) : null,
      puestoId: usuario.puesto_id,
      puestoDeOdoo: null,
      puestoCorregido: false,
      puestoResuelve: true,
      empresa: null,
      lider: usuario.superior_id ? (nombrePorUsuarioId.get(usuario.superior_id) ?? null) : null,
      liderResuelve: true,
      rol: usuario.rol,
      activo: usuario.activo,
      fechaIngreso: null,
      ultimoIngreso: usuario.ultimo_ingreso,
      invitadoEn: null,
      invitacionesEnviadas: 0,
      enElPadron: false,
    });
  }

  personas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const ingresaron = personas.filter((p) => p.usuarioId !== null).length;
  const pendientes = personas.length - ingresaron;
  const sinPuesto = personas.filter((p) => p.enElPadron && !p.puestoResuelve).length;
  const sinLider = personas.filter(
    (p) => p.enElPadron && p.lider !== null && !p.liderResuelve,
  ).length;

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Toda la gente en una lista: quiénes ya entraron y quiénes todavía no. Sale de la exportación de Odoo; el perfil se arma solo en el primer ingreso con Google."
        acciones={
          <>
            {/* La prueba va primero: es lo que corresponde hacer antes de
                tocar el que invita de verdad. */}
            <BotonProbarCorreo />
            <BotonInvitarAPendientes pendientes={pendientes} />
            {/* El alta de puesto vive acá además de en Recursos Humanos.
                Si el puesto de alguien todavía no existe, obligar a irse
                a otro módulo, crearlo y volver es la forma más rápida de
                que nadie lo asigne. Es el mismo formulario y la misma
                acción: no hay dos lugares donde se cree un puesto, hay
                dos puertas. */}
            <FormularioPuesto empresas={empresas} />
          </>
        }
      />

      <Aviso className="mb-4">
        <div>
          <AvisoTitulo>El rol y los permisos aparecen cuando la persona ingresa</AvisoTitulo>
          <AvisoDescripcion>
            Cualquier cuenta de {DOMINIOS_AUTORIZADOS_TEXTO} puede entrar, y el sistema le crea el
            perfil con rol Colaborador en ese momento. Antes de eso no hay nada que configurarle:
            el perfil depende de la cuenta de Google y la crea Google, no la intranet. Por eso
            quien está <strong>Pendiente</strong> lleva el botón que lo invita, y quien ya entró
            lleva a su ficha, donde se le ajusta el rol, el líder inmediato, el puesto, qué ventas
            ve y qué módulos tiene habilitados.
          </AvisoDescripcion>
        </div>
      </Aviso>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
            Personas
          </p>
          <p className="mt-1.5 text-2xl font-semibold leading-none tabular">{personas.length}</p>
          <p className="mt-3 text-[11px] text-atenuado-contraste">
            Con cuenta del Workspace
          </p>
        </Tarjeta>

        <Tarjeta className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
            Ya ingresaron
          </p>
          <p className="mt-1.5 text-2xl font-semibold leading-none tabular text-semaforo-bajo">
            {ingresaron}
          </p>
          <p className="mt-3 text-[11px] text-atenuado-contraste">
            Faltan {pendientes} de {personas.length}
          </p>
        </Tarjeta>

        <Tarjeta className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
            Sin puesto equivalente
          </p>
          <p
            className={`mt-1.5 text-2xl font-semibold leading-none tabular ${
              sinPuesto > 0 ? "text-semaforo-alto" : ""
            }`}
          >
            {sinPuesto}
          </p>
          <p className="mt-3 text-[11px] text-atenuado-contraste">
            {sinPuesto === 0
              ? "Todos resuelven contra un puesto cargado"
              : "Van a entrar sin puesto asignado"}
          </p>
        </Tarjeta>

        <Tarjeta className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
            Con líder fuera del padrón
          </p>
          <p
            className={`mt-1.5 text-2xl font-semibold leading-none tabular ${
              sinLider > 0 ? "text-semaforo-alto" : ""
            }`}
          >
            {sinLider}
          </p>
          <p className="mt-3 text-[11px] text-atenuado-contraste">
            {sinLider === 0
              ? "La línea de reporte cierra completa"
              : "No van a tener a quién escalar una acción"}
          </p>
        </Tarjeta>
      </div>

      <ListaUsuarios personas={personas} puestos={listaPuestos} />
    </>
  );
}
