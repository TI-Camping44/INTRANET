"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Entrada, GrupoCampo } from "@/components/ui/campo";
import { guardarPerfilInicial } from "@/app/completar-perfil/acciones";
import { hoyEnAsuncion } from "@/lib/formato";

/**
 * Los tres datos del primer ingreso.
 *
 * Google devuelve el nombre en una sola pieza: se ofrece partido como
 * sugerencia —la primera palabra es el nombre y el resto el apellido—
 * para que la mayoría solo tenga que confirmar, pero se puede corregir.
 * Es una sugerencia y no una regla: hay nombres compuestos y apellidos
 * de dos palabras, y adivinarlos mal y guardarlo sin que nadie mire
 * sería peor que pedirlo.
 */
export function FormularioPerfil({
  correo,
  nombres,
  apellidos,
  fechaNacimiento,
  nombreDeGoogle,
}: {
  correo: string;
  nombres: string | null;
  apellidos: string | null;
  fechaNacimiento: string | null;
  nombreDeGoogle: string;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);

  const partes = nombreDeGoogle.trim().split(/\s+/);
  const sugerenciaNombres = nombres ?? partes[0] ?? "";
  const sugerenciaApellidos = apellidos ?? partes.slice(1).join(" ");

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    const resultado = await guardarPerfilInicial(new FormData(evento.currentTarget));

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Perfil completado.");
      // `replace` y no `push`: volver atrás no debe traer de nuevo esta
      // pantalla, que ya no tiene nada que pedir.
      router.replace("/inicio");
      router.refresh();
    } else {
      toast.error(resultado.error);
      definirEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="mt-5 space-y-3">
      <GrupoCampo etiqueta="Correo" htmlFor="correo">
        <Entrada id="correo" value={correo} readOnly disabled />
      </GrupoCampo>

      <GrupoCampo etiqueta="Nombres" htmlFor="nombres" requerido>
        <Entrada
          id="nombres"
          name="nombres"
          required
          minLength={2}
          autoComplete="given-name"
          defaultValue={sugerenciaNombres}
        />
      </GrupoCampo>

      <GrupoCampo etiqueta="Apellidos" htmlFor="apellidos" requerido>
        <Entrada
          id="apellidos"
          name="apellidos"
          required
          minLength={2}
          autoComplete="family-name"
          defaultValue={sugerenciaApellidos}
        />
      </GrupoCampo>

      <GrupoCampo
        etiqueta="Fecha de nacimiento"
        htmlFor="fecha_nacimiento"
        requerido
        ayuda="Con esto aparece en los cumpleaños del mes de la portada."
      >
        <Entrada
          id="fecha_nacimiento"
          name="fecha_nacimiento"
          type="date"
          required
          max={hoyEnAsuncion()}
          defaultValue={fechaNacimiento ?? ""}
        />
      </GrupoCampo>

      <Boton type="submit" cargando={enviando} className="w-full">
        Guardar y entrar
      </Boton>
    </form>
  );
}
