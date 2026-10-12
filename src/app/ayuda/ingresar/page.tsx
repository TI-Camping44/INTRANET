import type { Metadata } from "next";
import Link from "next/link";

import { LogotipoOficial } from "@/components/comunes/logotipo-oficial";
import {
  DOMINIOS_AUTORIZADOS_TEXTO,
  NOMBRE_EMPRESA,
  NOMBRE_EMPRESA_VITALICA,
  NOMBRE_SISTEMA,
} from "@/lib/constantes";

export const metadata: Metadata = {
  title: "Cómo entrar a la Intranet",
  description: "Tres pasos para entrar con su cuenta de Google del trabajo.",
};

/**
 * El paso a paso para entrar, en una página pública.
 *
 * ES PUBLICA A PROPOSITO, y es la única forma de que sirva: la lee quien
 * todavía no tiene sesión. Mientras el tutorial vivía como PDF y video
 * sueltos en `public/`, el middleware los mandaba a `/ingresar` a
 * cualquiera sin sesión, así que los enlaces del correo de invitación no
 * funcionaban justamente para las 53 personas a las que iban dirigidos.
 *
 * SE MIRA, NO SE DESCARGA. El PDF obligaba a bajar un archivo para leer
 * tres pasos, y pedirle a alguien que descargue algo de un correo que
 * todavía no sabe si es legítimo es pedirle demasiado. Acá el video se
 * reproduce en la página y los pasos están escritos.
 *
 * NO LLEVA NINGUN DATO DE NADIE, y no puede llevarlo: todo lo que cuelgue
 * de `/ayuda` queda abierto a Internet.
 */

const PASOS = [
  {
    titulo: "Abra la intranet",
    detalle:
      "Desde el enlace del correo, o escribiendo la dirección en el navegador. Funciona igual en la computadora y en el celular.",
  },
  {
    titulo: "Toque «Continuar con Google»",
    detalle:
      "Es el único botón de la pantalla. No hay usuario ni contraseña que crear: se entra con la misma cuenta con la que abre su correo del trabajo.",
  },
  {
    titulo: "Elija su cuenta del trabajo",
    detalle: `La que termina en ${DOMINIOS_AUTORIZADOS_TEXTO}. La primera vez su perfil se arma solo, con el nombre y el puesto que ya están cargados.`,
  },
];

const PROBLEMAS = [
  {
    sintoma: "«Esa cuenta no pertenece a camping44.com.py o vitalica.com.py»",
    causa:
      "Eligió su Gmail personal. Es lo que más pasa. Vuelva atrás y elija la cuenta del trabajo; si no aparece en la lista, cierre la sesión personal en el navegador o abra una ventana de incógnito.",
  },
  {
    sintoma: "«Su usuario está inactivo»",
    causa: "La cuenta existe pero está desactivada en el sistema. Lo resuelve TI.",
  },
  {
    sintoma: "La pantalla queda en blanco",
    causa: "Es una pestaña vieja que se recargó. Abra el enlace de nuevo.",
  },
];

export default function PaginaAyudaIngresar() {
  return (
    <main className="min-h-dvh bg-fondo px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <LogotipoOficial alto={72} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Cómo entrar a la {NOMBRE_SISTEMA}
            </h1>
            <p className="text-sm text-atenuado-contraste">
              {NOMBRE_EMPRESA} · {NOMBRE_EMPRESA_VITALICA}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-borde bg-tarjeta p-5">
          <p className="text-sm font-semibold">No hay que crear ninguna contraseña</p>
          <p className="mt-1 text-xs leading-relaxed text-atenuado-contraste">
            Se entra con la misma cuenta de Google con la que abre su correo del trabajo. Son tres
            pasos y no llega al minuto.
          </p>

          <ol className="mt-5 space-y-4">
            {PASOS.map((paso, posicion) => (
              <li key={paso.titulo} className="flex gap-3">
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full
                             bg-primario text-xs font-semibold text-primario-contraste"
                  aria-hidden="true"
                >
                  {posicion + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{paso.titulo}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-atenuado-contraste">
                    {paso.detalle}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <Link
            href="/ingresar"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primario
                       px-6 text-sm font-medium text-primario-contraste transition-colors
                       hover:bg-primario/90"
          >
            Ingresar a la intranet
          </Link>
        </div>

        {/* EL VIDEO SE REPRODUCE ACA, no se descarga. Va sin voz —todo lo
            dice en pantalla— para que se pueda mirar sin auriculares en
            el piso de venta, que es donde se va a mirar. */}
        <section className="mt-6 rounded-lg border border-borde bg-tarjeta p-5">
          <h2 className="text-sm font-semibold">Verlo en video</h2>
          <p className="mt-1 text-xs leading-relaxed text-atenuado-contraste">
            Cuarenta segundos, sin audio: todo lo que hay que hacer se lee en pantalla.
          </p>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src="/ayuda/como-ingresar.mp4"
            controls
            playsInline
            preload="metadata"
            poster="/ayuda/como-ingresar.png"
            className="mt-3 w-full rounded-md border border-borde bg-black"
          />
        </section>

        <section className="mt-6 rounded-lg border border-borde bg-tarjeta p-5">
          <h2 className="text-sm font-semibold">Si algo no sale</h2>
          <dl className="mt-3 space-y-4">
            {PROBLEMAS.map((problema) => (
              <div key={problema.sintoma}>
                <dt className="text-xs font-medium">{problema.sintoma}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-atenuado-contraste">
                  {problema.causa}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-atenuado-contraste">
          Si nada de esto resuelve, escriba al responsable de TI.{" "}
          {/* El PDF queda, pero abajo y dicho como lo que es: para
              imprimir y pegar en depósito y piso de venta. Quien entra
              desde el celular no necesita descargar nada. */}
          <a
            href="/ayuda/como-ingresar.pdf"
            className="underline underline-offset-2"
            download
          >
            Descargar esta guía en PDF
          </a>{" "}
          para imprimirla y pegarla en el depósito o el piso de venta.
        </p>
      </div>
    </main>
  );
}
