import { redirect } from "next/navigation";
import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { CODIGO_PROCESO_CAPITAL_HUMANO, ROLES_GESTION } from "@/lib/constantes";
import {
  esClaveDeModulo,
  permisosDelAdministrador,
  permisosVacios,
  rolConPisoCompleto,
  type ClaveModulo,
  type PermisosDelRol,
} from "@/lib/permisos";
import type { RolUsuario, Usuario } from "@/lib/tipos";

/**
 * Perfil de la persona conectada. Se memoriza por peticion para no
 * repetir la consulta en cada componente de servidor que lo necesite.
 */
export const obtenerUsuarioActual = cache(async (): Promise<Usuario | null> => {
  const supabase = crearClienteServidor();

  const {
    data: { user: cuenta },
  } = await supabase.auth.getUser();

  if (!cuenta) return null;

  const { data: perfil } = await supabase
    .from("usuarios")
    .select(
      "id, empresa_id, correo, nombre_completo, nombres, apellidos, fecha_nacimiento, " +
        "rol, puesto_id, proceso_id, superior_id, telefono, url_avatar, activo, ultimo_ingreso",
    )
    .eq("id", cuenta.id)
    .maybeSingle();

  return (perfil as Usuario | null) ?? null;
});

/**
 * El perfil esta completo cuando tiene nombres, apellidos y fecha de
 * nacimiento.
 *
 * Los tres se piden en el primer ingreso. Google devuelve un
 * `nombre_completo` en una sola pieza y no devuelve el cumpleaños, asi
 * que sin este paso el legajo nace incompleto y los cumpleaños del mes
 * de la portada quedan vacios para siempre: nadie vuelve a entrar a un
 * perfil que ya anda.
 */
export function perfilCompleto(usuario: Usuario | null): boolean {
  return Boolean(
    usuario?.nombres?.trim() && usuario?.apellidos?.trim() && usuario?.fecha_nacimiento,
  );
}

/**
 * Igual que la anterior, pero redirige si no hay sesion valida.
 *
 * Y MANDA A COMPLETAR EL PERFIL si falta. Es la unica pantalla que
 * queda accesible con el perfil incompleto, ademas de la propia de
 * completarlo y la de salir: lo pidio Direccion el 5 de octubre para que
 * «Personas sin Puesto» y los cumpleaños se alimenten solos.
 */
export async function requerirUsuario(): Promise<Usuario> {
  const usuario = await obtenerUsuarioActual();

  if (!usuario) redirect("/ingresar");
  if (!usuario.activo) redirect("/sin-acceso?motivo=inactivo");
  if (!perfilCompleto(usuario)) redirect("/completar-perfil");

  return usuario;
}

/**
 * Como `requerirUsuario`, pero sin exigir el perfil completo.
 *
 * La usa la pantalla de completarlo: si usara la otra, se mandaria a si
 * misma en un bucle.
 */
export async function requerirUsuarioSinPerfil(): Promise<Usuario> {
  const usuario = await obtenerUsuarioActual();

  if (!usuario) redirect("/ingresar");
  if (!usuario.activo) redirect("/sin-acceso?motivo=inactivo");

  return usuario;
}

/** Corta el paso si el rol no esta entre los admitidos. */
export async function requerirRol(roles: RolUsuario[]): Promise<Usuario> {
  const usuario = await requerirUsuario();

  if (!roles.includes(usuario.rol)) {
    redirect("/sin-acceso?motivo=permisos");
  }

  return usuario;
}

export function puedeGestionar(usuario: Usuario | null): boolean {
  return !!usuario && ROLES_GESTION.includes(usuario.rol);
}

/**
 * Si la persona es la responsable de ese proceso.
 *
 * ES EL ESPEJO EXACTO DE `es_responsable_de_proceso()` EN SQL, y tiene
 * que seguir siéndolo: esa función es la que deciden las siete
 * políticas que gobiernan las escrituras por proceso —documentos, no
 * conformidades, acciones de NC, riesgos, cambios y mediciones de
 * indicadores—.
 *
 * ANTES LAS PANTALLAS PREGUNTABAN OTRA COSA. Comparaban
 * `registro.proceso_id === usuario.proceso_id`, que es un campo
 * distinto: `usuarios.proceso_id` dice a qué proceso PERTENECE la
 * persona, y la responsabilidad vive del lado del proceso, en
 * `procesos.responsable_id`. Con los dos campos desalineados la
 * pantalla dibujaba «Editar» y la base rechazaba la escritura, que es
 * la peor de las dos equivocaciones posibles: un botón que promete algo
 * que no va a pasar.
 *
 * Y LA RESPONSABILIDAD ADMITE VARIOS PROCESOS POR PERSONA, porque la
 * columna está del lado del proceso: N procesos pueden apuntar al mismo
 * responsable. El campo del perfil, en cambio, es uno solo, y está bien
 * que lo sea: se pertenece a un proceso.
 */
export async function esResponsableDelProceso(
  usuario: Usuario | null,
  procesoId: string | null,
): Promise<boolean> {
  if (!usuario || !procesoId) return false;

  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("procesos")
    .select("responsable_id")
    .eq("id", procesoId)
    .maybeSingle();

  return (data as { responsable_id: string | null } | null)?.responsable_id === usuario.id;
}

export function esAdministrador(usuario: Usuario | null): boolean {
  return usuario?.rol === "administrador_sgc";
}

export function esSoloLectura(usuario: Usuario | null): boolean {
  return usuario?.rol === "direccion";
}

/**
 * Quien puede cargar y corregir la respuesta de una desviacion.
 *
 * ES LA SEGUNDA ESCRITURA DE DIRECCION EN TODO EL SISTEMA, despues de
 * mover el organigrama, y es igual de acotada: Direccion escribe
 * UNICAMENTE la respuesta de la desviacion que tiene a su cargo. No le
 * abre ningun otro modulo, ni siquiera editar la no conformidad en si
 * —el titulo, el area y la severidad siguen siendo de Calidad—.
 *
 * Hizo falta porque Calidad le asigna el tratamiento a Direccion. A
 * Ariel Kemper le llego NC-2026-010 con el correo que le pide analizar
 * la causa raiz y definir el plan, y el sistema lo mandaba a «Sin
 * acceso»: un tratamiento asignado a alguien que no puede cargarlo es
 * una desviacion que no se cierra nunca.
 *
 * OJO CON LA MATRIZ DE PERMISOS: a `direccion` le figura
 * `editar = true` en 16 de los 21 modulos, asi que el unico freno real
 * es este archivo. Por eso la excepcion se escribe como una pregunta
 * concreta —«¿es el responsable de ESTA desviacion?»— y no sacando el
 * control de solo lectura, que le abriria los otros quince de una.
 *
 * Para todos los demas roles devuelve `true` y el permiso lo resuelve
 * RLS, que es donde vive: `nc_acciones_gestion` exige ser el
 * responsable, quien la detecto, el responsable del proceso o Calidad.
 */
export function puedeResponderLaDesviacion(
  usuario: Usuario | null,
  responsableId: string | null,
): boolean {
  if (!usuario) return false;
  if (!esSoloLectura(usuario)) return true;
  return responsableId !== null && responsableId === usuario.id;
}

/**
 * Quien puede mover el organigrama: Calidad y Dirección.
 *
 * ES LA ÚNICA ESCRITURA DE DIRECCIÓN EN TODO EL SISTEMA. El rol es de
 * solo lectura en los demás módulos y sigue siéndolo; esta es la
 * excepción, y es deliberada: la línea de reporte la conoce Dirección,
 * no Calidad, y el dato que trae Odoo no siempre es el real.
 *
 * El permiso de verdad está en `mover_en_organigrama()`, que es
 * `SECURITY DEFINER` y vuelve a comprobarlo. Esto solo decide si la
 * pantalla deja arrastrar: ocultar un botón no es un control de acceso.
 */
export function puedeEditarElOrganigrama(usuario: Usuario | null): boolean {
  return usuario?.rol === "administrador_sgc" || usuario?.rol === "direccion";
}

/** Gestiona el programa de auditorias: Calidad y los auditores internos. */
export function puedeGestionarAuditorias(usuario: Usuario | null): boolean {
  return usuario?.rol === "administrador_sgc" || usuario?.rol === "auditor";
}

/**
 * Quien sube el Perfil de Resultados de Puesto: Calidad y Capital Humano.
 *
 * NO ES «LOS JEFES DE AREA». El rol `responsable_proceso` lo comparten
 * los cuatro jefes que ingresaron, y el R-02-01 lo custodia Capital
 * Humano: habilitarlo por rol se lo daria tambien a Logistica, a
 * Comercial y al Canal Consumidor Final. Por eso se mira el PROCESO que
 * la persona tiene asignado y no su rol.
 *
 * ES PARA TODOS LOS PUESTOS, no solo los del area de Capital Humano: el
 * formulario es de ellos para toda la empresa.
 *
 * ASI ESTABA ROTO HASTA EL 2 DE NOVIEMBRE, y vale la pena que quede
 * escrito: la accion admitia `puedeGestionar()` —Calidad y los cuatro
 * jefes— y la pantalla dibujaba el formulario solo con
 * `esAdministrador()`. El permiso estaba concedido y el boton no se
 * dibujaba nunca, que es el error inverso al habitual: un boton
 * escondido tapando un permiso que si existia.
 */
export async function puedeSubirPerfilDePuesto(usuario: Usuario | null): Promise<boolean> {
  if (esAdministrador(usuario)) return true;
  if (!usuario?.proceso_id) return false;

  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("procesos")
    .select("codigo")
    .eq("id", usuario.proceso_id)
    .maybeSingle();

  return (data as { codigo: string } | null)?.codigo === CODIGO_PROCESO_CAPITAL_HUMANO;
}

/**
 * Lo que ve y edita el rol de la persona conectada, módulo por módulo.
 *
 * Se memoriza por petición: lo consultan el menú del layout y cada
 * pantalla que se protege, y sin esto sería la misma consulta repetida
 * media docena de veces por carga.
 *
 * EL ADMINISTRADOR SGC NO CONSULTA LA TABLA. Su piso está en
 * `puede_ver()` y `puede_editar()` de la base, y acá se refleja igual:
 * una matriz mal cargada no puede dejar al sistema sin nadie capaz de
 * entrar a arreglarla.
 *
 * Si la consulta falla, se devuelve la matriz vacía. Cierra de más en
 * vez de abrir de más, que es como tiene que fallar un permiso.
 */
export const obtenerPermisos = cache(async (): Promise<PermisosDelRol> => {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return permisosVacios();
  if (rolConPisoCompleto(usuario.rol)) return permisosDelAdministrador();

  const supabase = crearClienteServidor();
  const { data, error } = await supabase
    .from("permisos")
    .select("modulo, ver, editar")
    .eq("rol", usuario.rol);

  if (error) {
    // LA TABLA TODAVIA NO EXISTE: el código llegó antes que la
    // migración. Las migraciones se aplican a mano, así que entre el
    // despliegue y el `psql` hay una ventana, y fallar cerrado ahí
    // dejaría a todos menos al Administrador SGC sin menú y sin
    // entender por qué.
    //
    // En esa ventana se devuelve lo que el sistema hacía ANTES de que
    // existiera la matriz: todo visible. No es abrir nada que estuviera
    // cerrado, es no cerrar todavía. Y se nota en el registro.
    //
    // Cualquier otro error sí cierra: un permiso que no se pudo leer
    // por un problema real no se asume concedido.
    if (error.code === "42P01") {
      console.warn(
        "permisos: la tabla no existe todavía. Aplique las migraciones " +
          "20261012000200 y 20261012000300. Hasta entonces rige el comportamiento anterior.",
      );
      return permisosDelAdministrador();
    }

    console.error("permisos:", error.message);
    return permisosVacios();
  }

  const matriz = permisosVacios();
  for (const fila of (data ?? []) as { modulo: string; ver: boolean; editar: boolean }[]) {
    if (esClaveDeModulo(fila.modulo)) {
      matriz[fila.modulo] = { ver: fila.ver, editar: fila.editar };
    }
  }

  return matriz;
});

/**
 * Corta el paso si el módulo no está habilitado para el rol.
 *
 * Es el equivalente de `requerirRol` para los módulos que no tienen
 * tabla propia —el panel de calidad, Aplicaciones, el directorio—, que
 * son los únicos donde RLS no puede decidir sola porque leen datos de
 * otros módulos o de ninguno.
 *
 * En los demás, esto solo evita una pantalla vacía: quien entre igual
 * escribiendo la dirección se va a encontrar con que la base no le
 * devuelve nada, que es donde está el control de verdad.
 */
export async function requerirModulo(modulo: ClaveModulo): Promise<Usuario> {
  const usuario = await requerirUsuario();
  const permisos = await obtenerPermisos();

  if (!permisos[modulo].ver) {
    redirect("/sin-acceso?motivo=permisos");
  }

  return usuario;
}

/** Como la anterior, pero exige poder editar el módulo. */
export async function requerirModuloEditable(modulo: ClaveModulo): Promise<Usuario> {
  const usuario = await requerirUsuario();
  const permisos = await obtenerPermisos();

  if (!permisos[modulo].editar) {
    redirect("/sin-acceso?motivo=permisos");
  }

  return usuario;
}
