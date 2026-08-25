# API de Sofidya · lo que expone y lo que no

Contrato verificado contra la documentación del propio Sofidya
(versión 2.1) y comprobado llamando al API con la clave de Camping 44 el
25 de agosto de 2026.

Este archivo existe porque la primera versión del script de importación
se escribió a ciegas, con diez comandos en español que yo inventé y que
no existen. Queda acá para que nadie los vuelva a inventar.

---

## Cómo se llama

```
GET https://www.sofidya.com/api/api.php?command=<comando>&SecretKey=<clave>
```

Los parámetros van codificados en la URL, no como cuerpo JSON. La
respuesta es JSON con `status`, `code` y `data`.

La clave sale de `SOFIDYA_SECRET_KEY`. Se genera en Sofidya, en
`user-api-key.php`, y ese mismo botón la regenera.

### Códigos de respuesta

| Código | Significa |
| --- | --- |
| `1000` | Ejecutó bien y devolvió datos |
| `200` | Ejecutó bien, sin datos |
| `2000` | **El comando no existe** |
| `2010` | Falta un parámetro obligatorio |
| `2020` | Error de sintaxis |
| `2030` | El formato de un parámetro no es válido |
| `3000` | No se encontró la clave API |
| `3010` | La clave es errónea o el usuario está inactivo |
| `4000` | Error no determinado |

La distinción entre `2000` y `2010` es la que permite descubrir el API:
el primero dice que el comando no existe, el segundo que existe pero le
falta algo.

---

## Los diez comandos de listado

| Comando | Parámetro además de `SecretKey` | Devuelve |
| --- | --- | --- |
| `get_organizations` | — | `id`, `denominacion`, `direccion`, `localidad`, `provincia`, `pais` |
| `get_offices` | `id_organizacion` | `id`, `denominacion`, `acronimo`, `direccion`, `localidad`, `provincia`, `pais` |
| `get_norms` | — | `id`, `denominacion`, `descripcion` |
| `get_procedures` | `id_sede` | `id`, `denominacion`, `id_sede`, `tipo_proceso`, `descripcion` |
| `get_assets` | `id_sede` | `id`, `denominacion`, `id_sede`, `acronimo`, `tipo_activo`, `id_responsable`, `clasificacion`, `ubicacion`, `configuracion` |
| `get_jobs` | — | `id`, `denominacion`, `id_sede`, `descripcion`, `funciones`, `requisitos`, `perfil` |
| `get_clients` | — | `id`, `nombre`, `nif`, `nombre_comercial`, `email`, `telefono`, `web`, `direccion`, `pais` |
| `get_providers` | — | `id`, `nombre`, `nif`, `pais`, `nombre_comercial`, `email`, `telefono`, `web`, `direccion` |
| `get_users` | — | `id`, `activo`, `nombre`, `apellidos`, `usuario_temporal`, `cargo`, `sede`, `organizacion`, `email` |
| `get_inf_listados_predef` | — | `id`, `nombre`, `fecha_creacion` |

Hay además comandos de alta, edición y borrado para cada entidad. No se
usan: la importación solo lee.

### El encadenamiento

Sedes, procesos y activos no se pueden pedir sueltos:

```
get_organizations          →  id de organización
  get_offices(id_organizacion)   →  id de sede
    get_procedures(id_sede)
    get_assets(id_sede)
```

### `tipo_proceso`

`get_procedures` devuelve **Estratégico**, **Misional** o **Soporte**,
que es la misma división del enum `tipo_proceso` del esquema:

| Sofidya | Acá |
| --- | --- |
| Estratégico | `estrategico` |
| Misional | `operativo` |
| Soporte | `apoyo` |

---

## Lo que el API NO expone

No están, y no es que falte encontrarles el nombre: no figuran en el
índice de funciones de Sofidya, y todos los nombres probados devolvieron
`2000`.

- Documentos
- Objetivos
- Riesgos y oportunidades
- Indicadores
- No conformidades
- Auditorías
- Comunicaciones
- Denuncias

**Eso hay que exportarlo a mano** desde cada módulo de la interfaz de
Sofidya. Es la mitad del sistema, y la que más nos interesa traer: el
histórico de no conformidades y la matriz de riesgos.

---

## Lo que se puede traer, y lo que conviene no traer

| Entidad | Registros | Decisión |
| --- | --- | --- |
| Personas | 93 | Trae nombre, cargo, sede y correo. No trae fecha de nacimiento, así que los cumpleaños siguen sin fuente. |
| Puestos | 44 | Trae funciones, requisitos y perfil. |
| Proveedores | 3 | Directo. |
| Clientes | ? | Directo. |
| Sedes, activos | ? | Por sede. |
| Normas | 1 | Directo. |
| **Procesos** | ? | **No importar sin mirar.** El mapa de procesos real ya está cargado desde la unidad compartida del SGC, con sus diecinueve manuales. Ese es el vigente; lo de Sofidya puede ser anterior. |

Sobre las personas hay una decisión pendiente que no es de datos sino de
diseño: `usuarios.id` referencia a `auth.users`, así que un perfil no
puede existir sin cuenta de Google. Precargar las 93 personas requiere
una tabla de legajo separada de `usuarios`, que se enlace cuando la
persona entra por primera vez.
