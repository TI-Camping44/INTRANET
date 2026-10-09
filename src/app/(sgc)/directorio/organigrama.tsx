import Link from "next/link";
import { FileText } from "lucide-react";
import { Avatar, AvatarImagen, AvatarRespaldo } from "@/components/ui/avatar";
import { Insignia } from "@/components/ui/insignia";
import { iniciales } from "@/lib/utilidades";

export interface NodoOrganigrama {
  clave: string;
  nombre_completo: string;
  puesto_id: string | null;
  puesto: string | null;
  area: string | null;
  url_avatar: string | null;
  ingreso: boolean;
  lider_clave: string | null;
}

interface Rama extends NodoOrganigrama {
  hijos: Rama[];
}

/**
 * Arma el arbol a partir de «de quien depende cada uno».
 *
 * CUIDADO CON LOS CICLOS. Si Odoo declara que A depende de B y B de A
 * —o que alguien es su propio jefe—, una construccion ingenua se cuelga
 * al dibujar. Por eso se recorre desde las raices marcando lo visitado:
 * lo que quede sin visitar es un ciclo, y se devuelve aparte en vez de
 * desaparecer sin avisar.
 */
export function armarOrganigrama(nodos: NodoOrganigrama[]): {
  raices: Rama[];
  sueltos: Rama[];
} {
  const porClave = new Map<string, Rama>(
    nodos.map((nodo) => [nodo.clave, { ...nodo, hijos: [] }]),
  );

  const raices: Rama[] = [];

  for (const rama of Array.from(porClave.values())) {
    const jefe = rama.lider_clave ? porClave.get(rama.lider_clave) : undefined;
    if (jefe && jefe.clave !== rama.clave) jefe.hijos.push(rama);
    else raices.push(rama);
  }

  const ordenar = (ramas: Rama[]) => {
    ramas.sort(
      (a, b) =>
        b.hijos.length - a.hijos.length ||
        a.nombre_completo.localeCompare(b.nombre_completo),
    );
    for (const rama of ramas) ordenar(rama.hijos);
  };
  ordenar(raices);

  // Lo alcanzable desde las raices. El resto es un ciclo.
  const vistos = new Set<string>();
  const recorrer = (ramas: Rama[]) => {
    for (const rama of ramas) {
      if (vistos.has(rama.clave)) continue;
      vistos.add(rama.clave);
      recorrer(rama.hijos);
    }
  };
  recorrer(raices);

  const sueltos = Array.from(porClave.values()).filter(
    (rama) => !vistos.has(rama.clave),
  );
  return { raices, sueltos };
}

function Caja({ nodo }: { nodo: Rama }) {
  return (
    <div
      className="flex w-[11.5rem] flex-col items-center gap-1.5 rounded-lg border
                 border-borde bg-tarjeta px-2.5 py-2.5 text-center"
    >
      <Avatar className="size-8">
        {nodo.url_avatar ? (
          <AvatarImagen src={nodo.url_avatar} alt={nodo.nombre_completo} />
        ) : null}
        <AvatarRespaldo className="text-[10px]">
          {iniciales(nodo.nombre_completo)}
        </AvatarRespaldo>
      </Avatar>

      <p className="text-[11px] font-semibold leading-tight">
        {nodo.nombre_completo}
      </p>

      {nodo.puesto ? (
        nodo.puesto_id ? (
          <Link
            href={`/recursos-humanos/puestos/${nodo.puesto_id}`}
            className="flex items-center justify-center gap-1 text-[10px] leading-tight
                       text-atenuado-contraste hover:text-primario"
            title="Ver el perfil del puesto"
          >
            <span>{nodo.puesto}</span>
            <FileText className="size-2.5 shrink-0" />
          </Link>
        ) : (
          <p className="text-[10px] leading-tight text-atenuado-contraste">
            {nodo.puesto}
          </p>
        )
      ) : null}

      {nodo.hijos.length > 0 ? (
        <Insignia variante="contorno" className="text-[9px]">
          {nodo.hijos.length} a cargo
        </Insignia>
      ) : null}

      {!nodo.ingreso ? (
        <span className="text-[9px] text-atenuado-contraste">Sin ingresar</span>
      ) : null}
    </div>
  );
}

function Nivel({ ramas }: { ramas: Rama[] }) {
  return (
    <ul>
      {ramas.map((rama) => (
        <li key={rama.clave}>
          <Caja nodo={rama} />
          {rama.hijos.length > 0 ? <Nivel ramas={rama.hijos} /> : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * El organigrama, de arriba hacia abajo.
 *
 * SE DESPLAZA DE COSTADO, NO LA PAGINA. Con 55 personas el arbol es mas
 * ancho que cualquier pantalla; el contenedor se lleva el
 * desplazamiento horizontal, como las tablas del resto del sistema.
 *
 * La linea de reporte sale del padron y, cuando el Administrador SGC la
 * cargo a mano, de `usuarios.superior_id`. Quien no tiene jefe declarado
 * aparece como raiz: con una sola raiz es la Presidencia; con varias,
 * las demas son personas a las que les falta el dato, y conviene que se
 * vea en vez de esconderse.
 */
export function Organigrama({ nodos }: { nodos: NodoOrganigrama[] }) {
  const { raices, sueltos } = armarOrganigrama(nodos);

  // La Presidencia primero: la raiz con mas gente colgando.
  const principal = raices[0];
  const otras = raices.slice(1);

  return (
    <div className="space-y-4">
      <div className="desplazable-x overflow-x-auto rounded-lg border border-borde bg-fondo p-4">
        <div className="organigrama inline-block min-w-full">
          {principal ? <Nivel ramas={[principal]} /> : null}
        </div>
      </div>

      {otras.length > 0 ? (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-atenuado-contraste">
            Sin líder declarado
          </h2>
          <p className="mb-2 text-[11px] text-atenuado-contraste">
            {otras.length === 1
              ? "Esta persona no cuelga"
              : "Estas personas no cuelgan"}{" "}
            de nadie: o el dato falta en Odoo, o su jefe no está en la nómina.
            Hasta que se corrija, a{" "}
            {otras.length === 1 ? "esta persona" : "estas personas"} no se les
            puede escalar una acción vencida.
          </p>
          <div className="desplazable-x overflow-x-auto rounded-lg border border-borde bg-fondo p-4">
            <div className="organigrama inline-block min-w-full">
              <Nivel ramas={otras} />
            </div>
          </div>
        </div>
      ) : null}

      {sueltos.length > 0 ? (
        <p className="text-[11px] leading-relaxed text-semaforo-alto">
          Hay {sueltos.length} persona{sueltos.length === 1 ? "" : "s"} en un
          círculo de reporte —alguien depende de quien depende de ella— y por
          eso no se dibuja
          {sueltos.length === 1 ? "" : "n"}. Hay que corregir la jerarquía en
          Odoo.
        </p>
      ) : null}
    </div>
  );
}
