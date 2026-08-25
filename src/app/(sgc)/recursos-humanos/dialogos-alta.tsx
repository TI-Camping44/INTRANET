"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import {
  Dialogo,
  DialogoCabecera,
  DialogoCierre,
  DialogoContenido,
  DialogoDescripcion,
  DialogoPie,
  DialogoTitulo,
} from "@/components/ui/dialogo";
import {
  crearCapacitacion,
  crearCompetencia,
  crearPuesto,
} from "@/app/(sgc)/recursos-humanos/acciones";
import { hoyEnAsuncion, sumarDias } from "@/lib/formato";
import type { ResultadoAccion } from "@/lib/tipos";

/** Alta rapida desde el listado, sin salir de la pantalla. */
function DialogoAlta({
  etiqueta,
  titulo,
  descripcion,
  accion,
  children,
}: {
  etiqueta: string;
  titulo: string;
  descripcion: string;
  accion: (datos: FormData) => Promise<ResultadoAccion>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [abierto, definirAbierto] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirProcesando(true);
    const resultado = await accion(new FormData(evento.currentTarget));
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Registro creado.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <>
      <Boton variante="contorno" tamano="pequeno" onClick={() => definirAbierto(true)}>
        <Plus /> {etiqueta}
      </Boton>

      <Dialogo open={abierto} onOpenChange={definirAbierto}>
        <DialogoContenido>
          <form onSubmit={enviar}>
            <DialogoCabecera>
              <DialogoTitulo>{titulo}</DialogoTitulo>
              <DialogoDescripcion>{descripcion}</DialogoDescripcion>
            </DialogoCabecera>

            <div className="mt-4 space-y-3">{children}</div>

            <DialogoPie className="mt-5">
              <DialogoCierre asChild>
                <Boton type="button" variante="contorno">
                  Cancelar
                </Boton>
              </DialogoCierre>
              <Boton type="submit" disabled={procesando}>
                Guardar
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </>
  );
}

export function AltaPuesto({
  procesos,
  codigoSugerido,
}: {
  procesos: { id: string; nombre: string }[];
  codigoSugerido: string;
}) {
  return (
    <DialogoAlta
      etiqueta="Nuevo puesto"
      titulo="Nuevo puesto"
      descripcion="El puesto es la unidad de la matriz: sobre él se definen las competencias exigidas."
      accion={crearPuesto}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <GrupoCampo etiqueta="Código" htmlFor="codigo" requerido>
          <Entrada id="codigo" name="codigo" defaultValue={codigoSugerido} required className="tabular" />
        </GrupoCampo>
        <GrupoCampo etiqueta="Área" htmlFor="area">
          <Entrada id="area" name="area" placeholder="Comercial" />
        </GrupoCampo>
      </div>
      <GrupoCampo etiqueta="Nombre del puesto" htmlFor="nombre" requerido>
        <Entrada id="nombre" name="nombre" required minLength={3} placeholder="Vendedor de salón" />
      </GrupoCampo>
      <GrupoCampo etiqueta="Proceso" htmlFor="proceso_id">
        <Seleccion id="proceso_id" name="proceso_id">
          <option value="">Sin proceso</option>
          {procesos.map((proceso) => (
            <option key={proceso.id} value={proceso.id}>
              {proceso.nombre}
            </option>
          ))}
        </Seleccion>
      </GrupoCampo>
      <GrupoCampo
        etiqueta="Misión del puesto"
        htmlFor="mision"
        ayuda="Para qué existe el puesto, en una frase."
      >
        <AreaTexto id="mision" name="mision" rows={2} />
      </GrupoCampo>
    </DialogoAlta>
  );
}

export function AltaCompetencia({ codigoSugerido }: { codigoSugerido: string }) {
  return (
    <DialogoAlta
      etiqueta="Nueva competencia"
      titulo="Nueva competencia"
      descripcion="Las competencias son las columnas de la matriz. Se exigen por puesto, con un nivel de 1 a 5."
      accion={crearCompetencia}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <GrupoCampo etiqueta="Código" htmlFor="codigo" requerido>
          <Entrada id="codigo" name="codigo" defaultValue={codigoSugerido} required className="tabular" />
        </GrupoCampo>
        <GrupoCampo etiqueta="Tipo" htmlFor="tipo" requerido>
          <Seleccion id="tipo" name="tipo" defaultValue="tecnica">
            <option value="tecnica">Técnica</option>
            <option value="conductual">Conductual</option>
            <option value="legal">Legal</option>
          </Seleccion>
        </GrupoCampo>
      </div>
      <GrupoCampo etiqueta="Nombre" htmlFor="nombre" requerido>
        <Entrada
          id="nombre"
          name="nombre"
          required
          minLength={3}
          placeholder="Normativa de material controlado"
        />
      </GrupoCampo>
      <GrupoCampo etiqueta="Descripción" htmlFor="descripcion">
        <AreaTexto id="descripcion" name="descripcion" rows={2} />
      </GrupoCampo>
    </DialogoAlta>
  );
}

export function AltaCapacitacion({
  competencias,
  codigoSugerido,
}: {
  competencias: { id: string; codigo: string; nombre: string }[];
  codigoSugerido: string;
}) {
  return (
    <DialogoAlta
      etiqueta="Nueva capacitación"
      titulo="Nueva capacitación"
      descripcion="Al vincularla a una competencia queda claro qué brecha viene a cerrar."
      accion={crearCapacitacion}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <GrupoCampo etiqueta="Código" htmlFor="codigo" requerido>
          <Entrada id="codigo" name="codigo" defaultValue={codigoSugerido} required className="tabular" />
        </GrupoCampo>
        <GrupoCampo etiqueta="Tipo" htmlFor="tipo" requerido>
          <Seleccion id="tipo" name="tipo" defaultValue="interna">
            <option value="interna">Interna</option>
            <option value="externa">Externa</option>
            <option value="en_linea">En línea</option>
            <option value="induccion">Inducción</option>
          </Seleccion>
        </GrupoCampo>
      </div>

      <GrupoCampo etiqueta="Nombre" htmlFor="nombre" requerido>
        <Entrada id="nombre" name="nombre" required minLength={5} />
      </GrupoCampo>

      <GrupoCampo etiqueta="Descripción" htmlFor="descripcion">
        <AreaTexto id="descripcion" name="descripcion" rows={2} />
      </GrupoCampo>

      <GrupoCampo
        etiqueta="Competencia que desarrolla"
        htmlFor="competencia_id"
        ayuda="Conecta la capacitación con la brecha detectada en la matriz."
      >
        <Seleccion id="competencia_id" name="competencia_id">
          <option value="">Sin competencia asociada</option>
          {competencias.map((competencia) => (
            <option key={competencia.id} value={competencia.id}>
              {competencia.codigo} · {competencia.nombre}
            </option>
          ))}
        </Seleccion>
      </GrupoCampo>

      <div className="grid gap-3 sm:grid-cols-2">
        <GrupoCampo etiqueta="Fecha de inicio" htmlFor="fecha_inicio">
          <Entrada
            id="fecha_inicio"
            name="fecha_inicio"
            type="date"
            defaultValue={sumarDias(hoyEnAsuncion(), 15)}
          />
        </GrupoCampo>
        <GrupoCampo etiqueta="Fecha de fin" htmlFor="fecha_fin">
          <Entrada id="fecha_fin" name="fecha_fin" type="date" />
        </GrupoCampo>
        <GrupoCampo etiqueta="Horas" htmlFor="horas">
          <Entrada id="horas" name="horas" type="number" step="0.5" min={0} className="tabular" />
        </GrupoCampo>
        <GrupoCampo etiqueta="Costo (Gs.)" htmlFor="costo_gs">
          <Entrada id="costo_gs" name="costo_gs" inputMode="numeric" className="tabular" />
        </GrupoCampo>
        <GrupoCampo etiqueta="Proveedor" htmlFor="proveedor_nombre">
          <Entrada id="proveedor_nombre" name="proveedor_nombre" />
        </GrupoCampo>
        <GrupoCampo etiqueta="Instructor" htmlFor="instructor">
          <Entrada id="instructor" name="instructor" />
        </GrupoCampo>
      </div>
    </DialogoAlta>
  );
}
