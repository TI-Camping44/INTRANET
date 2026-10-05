import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogotipoOficial } from "@/components/comunes/logotipo-oficial";
import { perfilCompleto, requerirUsuarioSinPerfil } from "@/lib/sesion";
import { FormularioPerfil } from "@/app/completar-perfil/formulario-perfil";

export const metadata: Metadata = { title: "Complete su perfil" };
export const dynamic = "force-dynamic";

/**
 * Lo que se pide la primera vez que alguien entra.
 *
 * El perfil se crea solo en el primer ingreso con Google, y Google trae
 * el nombre en una sola pieza y no trae el cumpleaños. Sin este paso el
 * legajo nace incompleto y los cumpleaños del mes de la portada quedan
 * vacíos para siempre: nadie vuelve a entrar a un perfil que ya anda.
 *
 * ESTÁ FUERA DEL GRUPO `(sgc)` a propósito. El layout de ese grupo llama
 * a `requerirUsuario`, que es justamente quien manda acá: si esta
 * pantalla viviera adentro, se mandaría a sí misma en un bucle.
 *
 * No pide el puesto. Eso lo asigna el Administrador SGC después, desde
 * «Personas sin Puesto»: una persona no se adjudica su propio puesto.
 */
export default async function PaginaCompletarPerfil() {
  const usuario = await requerirUsuarioSinPerfil();

  // Quien ya lo completó no tiene nada que hacer acá.
  if (perfilCompleto(usuario)) redirect("/inicio");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-fondo p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <LogotipoOficial ancho={160} />
        </div>

        <div className="rounded-lg border border-borde bg-tarjeta p-6">
          <h1 className="text-base font-semibold tracking-tight">Complete su perfil</h1>
          <p className="mt-1 text-xs leading-relaxed text-atenuado-contraste">
            Es la primera vez que entra. Estos datos van a su legajo y no se vuelven a pedir. Su
            puesto lo asigna Calidad después.
          </p>

          <FormularioPerfil
            correo={usuario.correo}
            nombres={usuario.nombres}
            apellidos={usuario.apellidos}
            fechaNacimiento={usuario.fecha_nacimiento}
            nombreDeGoogle={usuario.nombre_completo}
          />
        </div>
      </div>
    </main>
  );
}
