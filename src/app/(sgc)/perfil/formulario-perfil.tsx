"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Entrada, GrupoCampo } from "@/components/ui/campo";
import { actualizarPerfilPropio } from "@/app/(sgc)/administracion/usuarios/acciones";

export function FormularioPerfil({
  nombre,
  telefono,
  correo,
}: {
  nombre: string;
  telefono: string | null;
  correo: string;
}) {
  const router = useRouter();
  const [guardando, definirGuardando] = React.useState(false);

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirGuardando(true);
    const resultado = await actualizarPerfilPropio(new FormData(evento.currentTarget));
    definirGuardando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Perfil actualizado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <GrupoCampo etiqueta="Nombre completo" htmlFor="nombre_completo" requerido>
        <Entrada
          id="nombre_completo"
          name="nombre_completo"
          defaultValue={nombre}
          required
          minLength={3}
        />
      </GrupoCampo>

      <GrupoCampo
        etiqueta="Correo corporativo"
        htmlFor="correo"
        ayuda="Proviene de Google Workspace y no se puede modificar desde aquí."
      >
        <Entrada id="correo" value={correo} disabled readOnly />
      </GrupoCampo>

      <GrupoCampo etiqueta="Teléfono" htmlFor="telefono">
        <Entrada
          id="telefono"
          name="telefono"
          defaultValue={telefono ?? ""}
          placeholder="0981 123 456"
        />
      </GrupoCampo>

      <div className="flex justify-end">
        <Boton type="submit" tamano="pequeno" disabled={guardando}>
          <Save /> {guardando ? "Guardando…" : "Guardar cambios"}
        </Boton>
      </div>
    </form>
  );
}
