import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Users } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { InsigniaDemostracion } from "@/components/comunes/insignias-estado";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import {
  Pestanas,
  PestanaContenido,
  PestanaDisparador,
  PestanasLista,
} from "@/components/ui/pestanas";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import { esAdministrador, puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import {
  ETIQUETAS_ESTADO_CAPACITACION,
  ETIQUETAS_TIPO_CAPACITACION,
  ETIQUETAS_TIPO_COMPETENCIA,
} from "@/lib/constantes";
import { formatearFecha, formatearGuaranies, formatearNumero } from "@/lib/formato";
import type {
  EstadoCapacitacion,
  TipoCapacitacion,
  TipoCompetencia,
} from "@/lib/tipos";
import { AltaCapacitacion, AltaCompetencia, AltaPuesto } from "./dialogos-alta";
import { MatrizCompetencias, type Requisito } from "./matriz-competencias";
import { PanelBrechas } from "./panel-brechas";

export const metadata: Metadata = { title: "Recursos humanos" };
export const dynamic = "force-dynamic";

interface FilaPuesto {
  id: string;
  codigo: string;
  nombre: string;
  area: string | null;
  mision: string | null;
  procesos: { nombre: string } | null;
}

interface FilaCompetencia {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
}

interface FilaCapacitacion {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  estado: string;
  fecha_inicio: string | null;
  horas: number | null;
  costo_gs: number;
  es_demostracion: boolean;
  competencias: { codigo: string; nombre: string } | null;
}

interface FilaEvaluacion {
  id: string;
  usuario_id: string;
  competencia_id: string;
  nivel_actual: number;
  nivel_requerido: number;
  brecha: number;
  fecha: string;
  observacion: string | null;
  usuarios: { nombre_completo: string; puestos: { nombre: string } | null } | null;
  competencias: { codigo: string; nombre: string } | null;
}

/** Sugiere el proximo codigo correlativo con el prefijo indicado. */
function siguienteCodigo(prefijo: string, existentes: string[], ancho = 2) {
  const usados = existentes
    .map((codigo) => Number(codigo.replace(`${prefijo}-`, "")))
    .filter((numero) => Number.isInteger(numero));
  const proximo = usados.length > 0 ? Math.max(...usados) + 1 : 1;
  return `${prefijo}-${String(proximo).padStart(ancho, "0")}`;
}

export default async function PaginaRecursosHumanos() {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const [
    { data: puestos },
    { data: competencias },
    { data: requisitos },
    { data: capacitaciones },
    { data: evaluaciones },
    { data: personas },
    { data: procesos },
  ] = await Promise.all([
    supabase
      .from("puestos")
      .select("id, codigo, nombre, area, mision, procesos:proceso_id (nombre)")
      .eq("activo", true)
      .order("codigo"),
    supabase.from("competencias").select("id, codigo, nombre, descripcion, tipo").order("codigo"),
    supabase
      .from("puesto_competencias")
      .select("puesto_id, competencia_id, nivel_requerido, critica"),
    supabase
      .from("capacitaciones")
      .select(
        "id, codigo, nombre, tipo, estado, fecha_inicio, horas, costo_gs, es_demostracion," +
          " competencias:competencia_id (codigo, nombre)",
      )
      .order("fecha_inicio", { ascending: false, nullsFirst: false }),
    supabase
      .from("evaluaciones_competencia")
      .select(
        "id, usuario_id, competencia_id, nivel_actual, nivel_requerido, brecha, fecha," +
          " observacion, usuarios:usuario_id (nombre_completo, puestos:puesto_id (nombre))," +
          " competencias:competencia_id (codigo, nombre)",
      )
      .order("fecha", { ascending: false }),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
    supabase.from("procesos").select("id, nombre").order("nombre"),
  ]);

  const listaPuestos = (puestos ?? []) as unknown as FilaPuesto[];
  const listaCompetencias = (competencias ?? []) as unknown as FilaCompetencia[];
  const listaRequisitos = (requisitos ?? []) as unknown as Requisito[];
  const listaCapacitaciones = (capacitaciones ?? []) as unknown as FilaCapacitacion[];
  const listaPersonas = (personas ?? []) as { id: string; nombre_completo: string }[];
  const listaProcesos = (procesos ?? []) as { id: string; nombre: string }[];

  // De cada persona y competencia interesa la evaluacion mas reciente: las
  // anteriores son historia, no estado actual.
  const vistas = new Set<string>();
  const ultimasEvaluaciones = ((evaluaciones ?? []) as unknown as FilaEvaluacion[]).filter(
    (evaluacion) => {
      const clave = `${evaluacion.usuario_id}|${evaluacion.competencia_id}`;
      if (vistas.has(clave)) return false;
      vistas.add(clave);
      return true;
    },
  );

  const conBrecha = ultimasEvaluaciones.filter((evaluacion) => evaluacion.brecha > 0).length;
  const horasDelAno = listaCapacitaciones
    .filter((capacitacion) => capacitacion.estado === "finalizada")
    .reduce((suma, capacitacion) => suma + Number(capacitacion.horas ?? 0), 0);
  // Lo invertido es lo que ya se dicto; lo planificado todavia puede no
  // ocurrir. Sumarlos en un solo numero abulta el gasto real.
  const invertido = listaCapacitaciones
    .filter((capacitacion) => capacitacion.estado === "finalizada")
    .reduce((suma, capacitacion) => suma + Number(capacitacion.costo_gs ?? 0), 0);
  const planificado = listaCapacitaciones
    .filter(
      (capacitacion) =>
        capacitacion.estado === "planificada" || capacitacion.estado === "en_curso",
    )
    .reduce((suma, capacitacion) => suma + Number(capacitacion.costo_gs ?? 0), 0);

  const gestiona = puedeGestionar(usuario);
  const administra = esAdministrador(usuario);

  return (
    <>
      <EncabezadoPagina
        titulo="Recursos humanos"
        descripcion="Puestos y perfiles, matriz de competencias, capacitaciones y verificación de su eficacia."
        acciones={
          gestiona ? (
            <div className="flex flex-wrap gap-2">
              {administra ? (
                <>
                  <AltaPuesto
                    procesos={listaProcesos}
                    codigoSugerido={siguienteCodigo(
                      "P",
                      listaPuestos.map((puesto) => puesto.codigo),
                      3,
                    )}
                  />
                  <AltaCompetencia
                    codigoSugerido={siguienteCodigo(
                      "CMP",
                      listaCompetencias.map((competencia) => competencia.codigo),
                    )}
                  />
                </>
              ) : null}
              <AltaCapacitacion
                competencias={listaCompetencias}
                codigoSugerido={siguienteCodigo(
                  "CAP",
                  listaCapacitaciones.map((capacitacion) => capacitacion.codigo),
                )}
              />
            </div>
          ) : null
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador titulo="Puestos" valor={listaPuestos.length} />
        <TarjetaIndicador
          titulo="Competencias exigidas"
          valor={listaRequisitos.length}
          contexto={`sobre ${listaCompetencias.length} definidas`}
        />
        <TarjetaIndicador
          titulo="Brechas abiertas"
          valor={conBrecha}
          tono={conBrecha > 0 ? "atencion" : "exito"}
          contexto="personas por debajo del nivel exigido"
        />
        <TarjetaIndicador
          titulo="Invertido en capacitación"
          valor={formatearGuaranies(invertido)}
          contexto={
            `${formatearNumero(horasDelAno, 1)} horas dictadas` +
            (planificado > 0 ? ` · ${formatearGuaranies(planificado)} planificado` : "")
          }
        />
      </div>

      <Pestanas defaultValue="matriz">
        <PestanasLista>
          <PestanaDisparador value="matriz">Matriz de competencias</PestanaDisparador>
          <PestanaDisparador value="brechas">Brechas ({conBrecha})</PestanaDisparador>
          <PestanaDisparador value="capacitaciones">
            Capacitaciones ({listaCapacitaciones.length})
          </PestanaDisparador>
          <PestanaDisparador value="puestos">Puestos ({listaPuestos.length})</PestanaDisparador>
          <PestanaDisparador value="competencias">
            Competencias ({listaCompetencias.length})
          </PestanaDisparador>
        </PestanasLista>

        <PestanaContenido value="matriz">
          <MatrizCompetencias
            puestos={listaPuestos}
            competencias={listaCompetencias}
            requisitos={listaRequisitos}
            puedeEditar={administra}
          />
        </PestanaContenido>

        <PestanaContenido value="brechas">
          <PanelBrechas
            evaluaciones={ultimasEvaluaciones}
            personas={listaPersonas}
            competencias={listaCompetencias}
            puedeEvaluar={gestiona}
          />
        </PestanaContenido>

        <PestanaContenido value="capacitaciones">
          {listaCapacitaciones.length === 0 ? (
            <EstadoVacio
              icono={<GraduationCap className="size-6" />}
              titulo="Sin capacitaciones registradas"
              descripcion="Planifique la primera para empezar a cerrar las brechas de la matriz."
            />
          ) : (
            <Tarjeta>
              <Tabla>
                <TablaCabecera>
                  <TablaFila>
                    <TablaEncabezado className="w-[7rem]">Código</TablaEncabezado>
                    <TablaEncabezado>Capacitación</TablaEncabezado>
                    <TablaEncabezado className="hidden lg:table-cell">Competencia</TablaEncabezado>
                    <TablaEncabezado className="hidden w-[7rem] md:table-cell">
                      Tipo
                    </TablaEncabezado>
                    <TablaEncabezado className="w-[7rem]">Inicio</TablaEncabezado>
                    <TablaEncabezado className="w-[5rem] text-right">Horas</TablaEncabezado>
                    <TablaEncabezado className="hidden w-[9rem] text-right md:table-cell">
                      Costo
                    </TablaEncabezado>
                    <TablaEncabezado className="w-[8rem]">Estado</TablaEncabezado>
                  </TablaFila>
                </TablaCabecera>
                <TablaCuerpo>
                  {listaCapacitaciones.map((capacitacion) => (
                    <TablaFila key={capacitacion.id}>
                      <TablaCelda className="font-medium tabular">
                        <Link
                          href={`/recursos-humanos/capacitaciones/${capacitacion.id}`}
                          className="hover:text-primario hover:underline"
                        >
                          {capacitacion.codigo}
                        </Link>
                      </TablaCelda>
                      <TablaCelda className="text-xs font-medium">
                        <Link
                          href={`/recursos-humanos/capacitaciones/${capacitacion.id}`}
                          className="hover:text-primario hover:underline"
                        >
                          {capacitacion.nombre}
                        </Link>
                        {capacitacion.es_demostracion ? (
                          <span className="ml-2 align-middle">
                            <InsigniaDemostracion />
                          </span>
                        ) : null}
                      </TablaCelda>
                      <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                        {capacitacion.competencias
                          ? `${capacitacion.competencias.codigo} · ${capacitacion.competencias.nombre}`
                          : "—"}
                      </TablaCelda>
                      <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                        {ETIQUETAS_TIPO_CAPACITACION[capacitacion.tipo as TipoCapacitacion] ??
                          capacitacion.tipo}
                      </TablaCelda>
                      <TablaCelda className="text-xs tabular">
                        {capacitacion.fecha_inicio
                          ? formatearFecha(capacitacion.fecha_inicio)
                          : "—"}
                      </TablaCelda>
                      <TablaCelda className="text-right text-xs tabular">
                        {capacitacion.horas === null
                          ? "—"
                          : formatearNumero(Number(capacitacion.horas), 1)}
                      </TablaCelda>
                      <TablaCelda className="hidden text-right text-xs tabular md:table-cell">
                        {capacitacion.costo_gs > 0
                          ? formatearGuaranies(capacitacion.costo_gs)
                          : "—"}
                      </TablaCelda>
                      <TablaCelda>
                        <Insignia
                          variante={
                            capacitacion.estado === "finalizada"
                              ? "exito"
                              : capacitacion.estado === "cancelada"
                                ? "neutra"
                                : capacitacion.estado === "en_curso"
                                  ? "primaria"
                                  : "contorno"
                          }
                        >
                          {ETIQUETAS_ESTADO_CAPACITACION[
                            capacitacion.estado as EstadoCapacitacion
                          ] ?? capacitacion.estado}
                        </Insignia>
                      </TablaCelda>
                    </TablaFila>
                  ))}
                </TablaCuerpo>
              </Tabla>
            </Tarjeta>
          )}
        </PestanaContenido>

        <PestanaContenido value="puestos">
          {listaPuestos.length === 0 ? (
            <EstadoVacio
              icono={<Users className="size-6" />}
              titulo="Sin puestos definidos"
              descripcion="Los perfiles de puesto se importan desde Sofidya o se cargan a mano."
            />
          ) : (
            <Tarjeta>
              <Tabla>
                <TablaCabecera>
                  <TablaFila>
                    <TablaEncabezado className="w-[7rem]">Código</TablaEncabezado>
                    <TablaEncabezado>Puesto</TablaEncabezado>
                    <TablaEncabezado className="hidden md:table-cell">Área</TablaEncabezado>
                    <TablaEncabezado className="hidden lg:table-cell">Proceso</TablaEncabezado>
                    <TablaEncabezado className="w-[6rem] text-right">Exigencias</TablaEncabezado>
                    <TablaEncabezado className="hidden xl:table-cell">Misión</TablaEncabezado>
                  </TablaFila>
                </TablaCabecera>
                <TablaCuerpo>
                  {listaPuestos.map((puesto) => (
                    <TablaFila key={puesto.id}>
                      <TablaCelda className="font-medium tabular">
                        <Link
                          href={`/recursos-humanos/puestos/${puesto.id}`}
                          className="hover:text-primario hover:underline"
                        >
                          {puesto.codigo}
                        </Link>
                      </TablaCelda>
                      <TablaCelda className="text-xs font-medium">
                        <Link
                          href={`/recursos-humanos/puestos/${puesto.id}`}
                          className="hover:text-primario hover:underline"
                        >
                          {puesto.nombre}
                        </Link>
                      </TablaCelda>
                      <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                        {puesto.area ?? "—"}
                      </TablaCelda>
                      <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                        {puesto.procesos?.nombre ?? "—"}
                      </TablaCelda>
                      <TablaCelda className="text-right text-xs tabular">
                        {
                          listaRequisitos.filter(
                            (requisito) => requisito.puesto_id === puesto.id,
                          ).length
                        }
                      </TablaCelda>
                      <TablaCelda className="hidden text-xs text-atenuado-contraste xl:table-cell">
                        {puesto.mision ?? "—"}
                      </TablaCelda>
                    </TablaFila>
                  ))}
                </TablaCuerpo>
              </Tabla>
            </Tarjeta>
          )}
        </PestanaContenido>

        <PestanaContenido value="competencias">
          {listaCompetencias.length === 0 ? (
            <EstadoVacio
              titulo="Sin competencias definidas"
              descripcion="Las competencias son las columnas de la matriz: defina las que exige la operación."
            />
          ) : (
            <Tarjeta>
              <Tabla>
                <TablaCabecera>
                  <TablaFila>
                    <TablaEncabezado className="w-[7rem]">Código</TablaEncabezado>
                    <TablaEncabezado>Competencia</TablaEncabezado>
                    <TablaEncabezado className="w-[8rem]">Tipo</TablaEncabezado>
                    <TablaEncabezado className="w-[6rem] text-right">Puestos</TablaEncabezado>
                    <TablaEncabezado className="hidden lg:table-cell">Descripción</TablaEncabezado>
                  </TablaFila>
                </TablaCabecera>
                <TablaCuerpo>
                  {listaCompetencias.map((competencia) => (
                    <TablaFila key={competencia.id}>
                      <TablaCelda className="font-medium tabular">{competencia.codigo}</TablaCelda>
                      <TablaCelda className="text-xs font-medium">{competencia.nombre}</TablaCelda>
                      <TablaCelda>
                        <Insignia variante="contorno">
                          {ETIQUETAS_TIPO_COMPETENCIA[competencia.tipo as TipoCompetencia] ??
                            competencia.tipo}
                        </Insignia>
                      </TablaCelda>
                      <TablaCelda className="text-right text-xs tabular">
                        {
                          listaRequisitos.filter(
                            (requisito) => requisito.competencia_id === competencia.id,
                          ).length
                        }
                      </TablaCelda>
                      <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                        {competencia.descripcion ?? "—"}
                      </TablaCelda>
                    </TablaFila>
                  ))}
                </TablaCuerpo>
              </Tabla>
            </Tarjeta>
          )}
        </PestanaContenido>
      </Pestanas>
    </>
  );
}
