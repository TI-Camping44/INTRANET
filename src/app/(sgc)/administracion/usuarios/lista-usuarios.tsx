"use client";

import * as React from "react";
import Link from "next/link";
import { Search, UserX } from "lucide-react";

import { Entrada } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import { FilaUsuario } from "@/app/(sgc)/administracion/usuarios/fila-usuario";
import { ETIQUETAS_ROL } from "@/lib/constantes";
import type { RolUsuario } from "@/lib/tipos";

interface UsuarioLista {
  id: string;
  nombre_completo: string;
  correo: string;
  rol: RolUsuario;
  superior_id: string | null;
  proceso_id: string | null;
  puesto_id: string | null;
  vendedor_planilla: string | null;
  ventas_canales: string[] | null;
  activo: boolean;
  ultimo_ingreso: string | null;
}

/** Para comparar sin que una tilde o una mayúscula separen. */
function normalizar(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * El listado de usuarios, con buscador.
 *
 * SE BUSCA EN EL NAVEGADOR Y NO EN LA BASE. Son 55 personas: mandarlas a
 * consultar en cada tecla sería más lento que filtrarlas acá, y encima
 * dejaría la pantalla parpadeando. Con miles de filas la decisión sería
 * la otra, como en el buscador de clientes del reclamo.
 *
 * SE BUSCA POR NOMBRE, CORREO, ROL Y PUESTO, y por partes: «carlos
 * calidad» encuentra a Carlos González con rol Administrador SGC. Buscar
 * solo por nombre obliga a saber de antemano a quién se busca, y la
 * pregunta de todos los días es la otra —quién tiene tal rol, quién
 * ocupa tal puesto—.
 */
export function ListaUsuarios({
  usuarios,
  procesos,
  puestos,
  vendedores,
}: {
  usuarios: UsuarioLista[];
  procesos: { id: string; nombre: string }[];
  puestos: { id: string; nombre: string }[];
  vendedores: string[];
}) {
  const [busqueda, definirBusqueda] = React.useState("");

  const nombrePorPuesto = React.useMemo(() => {
    const mapa = new Map<string, string>();
    for (const puesto of puestos) mapa.set(puesto.id, puesto.nombre);
    return mapa;
  }, [puestos]);

  const filtrados = React.useMemo(() => {
    const partes = normalizar(busqueda).split(/\s+/).filter(Boolean);
    if (partes.length === 0) return usuarios;

    return usuarios.filter((usuario) => {
      const texto = normalizar(
        [
          usuario.nombre_completo,
          usuario.correo,
          ETIQUETAS_ROL[usuario.rol],
          usuario.puesto_id ? nombrePorPuesto.get(usuario.puesto_id) : null,
          usuario.vendedor_planilla,
          usuario.activo ? "activo" : "inactivo",
        ]
          .filter(Boolean)
          .join(" "),
      );
      return partes.every((parte) => texto.includes(parte));
    });
  }, [busqueda, usuarios, nombrePorPuesto]);

  const personas = React.useMemo(
    () => usuarios.map(({ id, nombre_completo }) => ({ id, nombre_completo })),
    [usuarios],
  );

  return (
    <>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-atenuado-contraste" />
        <Entrada
          value={busqueda}
          onChange={(evento) => definirBusqueda(evento.target.value)}
          placeholder="Buscar por nombre, correo, rol o puesto…"
          aria-label="Buscar usuario"
          className="pl-9"
        />
      </div>

      <Tarjeta>
        <Tabla>
          <TablaCabecera>
            <TablaFila>
              <TablaEncabezado className="w-[16rem]">Persona</TablaEncabezado>
              <TablaEncabezado colSpan={6}>
                Rol · Líder inmediato · Proceso · Puesto · Estado
              </TablaEncabezado>
            </TablaFila>
          </TablaCabecera>
          <TablaCuerpo>
            {filtrados.length === 0 ? (
              <TablaFila>
                <TablaCelda colSpan={7} className="py-8 text-center">
                  <UserX className="mx-auto mb-2 size-5 text-atenuado-contraste" />
                  <p className="text-xs text-atenuado-contraste">
                    Ningún usuario coincide con «{busqueda}».
                  </p>
                  <p className="mt-1 text-[11px] text-atenuado-contraste">
                    Quien todavía no ingresó con Google no tiene perfil: búsquelo en el padrón de
                    la nómina.
                  </p>
                </TablaCelda>
              </TablaFila>
            ) : (
              filtrados.map((usuario) => (
                <FilaUsuario
                  key={usuario.id}
                  usuario={usuario}
                  personas={personas}
                  procesos={procesos}
                  puestos={puestos}
                  vendedores={vendedores}
                />
              ))
            )}
          </TablaCuerpo>
        </Tabla>
      </Tarjeta>

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {busqueda
          ? `${filtrados.length} de ${usuarios.length} usuarios.`
          : `${usuarios.length} usuario${usuarios.length === 1 ? "" : "s"} registrados.`}{" "}
        <Link href="/administracion/padron" className="underline underline-offset-2">
          Quienes todavía no ingresaron están en el padrón de la nómina.
        </Link>
      </p>
    </>
  );
}
