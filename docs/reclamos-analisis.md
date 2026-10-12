# Reclamos de clientes · lo que pide el documento contra lo que hay

Análisis del documento «Paso a Paso para el Desarrollo del Módulo
Reclamos de Clientes», recibido el 12 de octubre de 2026, contra el
módulo que está hoy en producción.

**El resumen en una línea: la mayor parte ya está construida.** De los
seis apartados del documento, cuatro están hechos o casi, uno es nuevo
de verdad —el control de compensaciones repetidas y el tablero— y otro
pide volver atrás decisiones tomadas hace tres días.

Lo que sigue está relevado contra la base y el código, no de memoria.

---

## 1 · Lo que ya está hecho

| El documento pide | Dónde está hoy |
| --- | --- |
| Gravedad Leve / Real / Grave con planes A, B y C | `gravedad_reclamo` y `plan_reclamo`, y la pantalla muestra qué plan activa cada gravedad |
| Reincidencia en 6 meses que sube un nivel | `hay_reincidencia_de_reclamo()` y `planDelCaso()` |
| Cronómetro de primer contacto | `fecha_limite_contacto`, 1 día hábil (el mismo día en Plan C) |
| Cronómetro de cierre | `fecha_limite_resolucion`: 3 / 7 / 15 días hábiles según el plan |
| Días **hábiles**, no corridos | `sumarDiasHabiles()`, que saltea sábados y domingos |
| Tareas con responsable y fecha límite | `reclamo_acciones` |
| No cerrar con tareas pendientes | Lo exige en los planes B y C: el caso no cierra hasta que estén todas ejecutadas |
| Tramos de autorización de compensaciones | `TRAMOS_AUTORIZACION`, con **los mismos montos del documento**: hasta Gs. 2.000.000 con tope del 50 %, hasta Gs. 6.000.000, y co-firma por encima |
| Registrar monto, tramo y quién autorizó | `compensacion_monto`, `monto_factura`, `autorizado_por`, `fecha_autorizacion` |
| Conformidad firmada del cliente | `conformidad_firmada`, con un `CHECK` que impide compensar sin ella |
| Alertas por vencimiento | El trabajo programado diario avisa por correo al vencer y un día antes |
| Material controlado | `material_controlado` |
| Reclamo que deriva en no conformidad | `generar_no_conformidad_desde_reclamo()` y `no_conformidad_id` |
| Imparcialidad: quien originó la falla no gestiona | Un `CHECK` en la base lo hace cumplir |

El flujo de estados también existe y es más detallado que el del
documento:

```
registrado → contactado → plan_definido → resuelto → cerrado
                  ↓             ↓             ↓
             no_conciliado  no_conciliado  no_conciliado
```

Más el rechazo del cliente, que no es un estado sino lo que sube el caso
al plan siguiente para otra propuesta.

> **Un bloqueo que acaba de destrabarse.** El código dice, textual: *«los
> cargos del procedimiento —Supervisor del Canal Consumidor Final, Jefe
> del Canal Consumidor Final— no coinciden con los puestos cargados, y
> adivinar quién firma plata es exactamente lo que no hay que
> adivinar»*. Esos dos puestos **ya existen** entre los 44 cargados. La
> autorización de compensaciones puede pasar de «se registra» a «se
> exige» sin inventar nada.

---

## 2 · Lo que falta de verdad

Esto es trabajo nuevo, ordenado por lo que cuesta:

1. **Aviso automático a Gerencia.** Hoy `notificado_gerencia` es una
   casilla que alguien marca a mano. El documento pide que el correo
   salga solo cuando el caso es Grave o involucra material controlado.
   El sistema de notificaciones ya existe; es conectarlo.
2. **Número de factura.** Está el monto —`monto_factura`— pero no el
   número, y el documento lo pide para poder rastrear la compensación.
3. **Canal de venta en el reclamo.** No está. Hoy se sabe el tipo de
   falla y el área responsable, no por qué canal compró el cliente.
4. **Exigir la autorización, no solo registrarla.** Ver el recuadro de
   arriba.
5. **Historial de compensaciones por cliente.** Para avisar —o
   bloquear— cuando un cliente ya recibió dos en el año hace falta
   poder contarlas. Hoy la compensación vive en el reclamo, una por
   caso, sin forma de sumarlas por cliente y por año.
6. **Tareas asignadas a un área, no a una persona.**
   `reclamo_acciones.responsable_id` apunta a una persona. El documento
   pide asignar al área de origen. Con el departamento del puesto ya
   cargado, esto es alcanzable.
7. **Estado propio de la tarea.** Hoy una acción está ejecutada o no,
   según tenga fecha. El documento pide que el área la marque como
   cumplida, que es un estado y un responsable de ese cambio.
8. **Tablero con semáforos.** No existe una pantalla de control del
   gestor con verde / amarillo / rojo por plazo.
9. **Informe mensual por área de origen.** No existe.
10. **Alerta de no conformidad por recurrencia.** «Si un área supera el
    5 % de reclamos por reincidencia dos meses seguidos» no existe, y
    es lo más caro de los diez: necesita el informe mensual, la serie
    histórica y la regla.

---

## 3 · Lo que choca con decisiones ya tomadas

Esto es lo que no se puede programar sin que Calidad y Dirección lo
confirmen, porque significa volver atrás algo decidido hace tres días.

| El documento pide | Qué pasó el 9 de octubre |
| --- | --- |
| **Gestor del Caso** como rol central que crea, asigna y cierra | Salió del alta, y el 12 de octubre salió también de la ficha. El aviso de asignación pasó al responsable del área, que es el único asignado al registrar: atado al gestor, nadie se enteraba de que tenía un reclamo con el plazo corriendo |
| **«¿Involucra Material Controlado?» obligatorio** en el alta | Salió del alta. La columna quedó |
| Incluir al Asistente de Gestión Regulatoria en el caso | «Otros departamentos intervinientes» salió del alta. La columna quedó |

Las tres salieron por el mismo motivo y está escrito en el commit: **se
preguntaban al registrar, que es cuando todavía no se sabe la
respuesta.**

No digo que el documento esté equivocado. Puede que Calidad haya
cambiado de criterio, o que quien lo escribió no supiera de esos
cambios. Pero son tres idas y vueltas sobre el mismo formulario en una
semana, y conviene que la decisión quede firmada antes de volver a
moverlo.

Hay además una diferencia de fondo:

> **El documento dice que la reincidencia sube la gravedad. El sistema
> sube el plan.** No es lo mismo. Subir el plan deja registrado que el
> hecho fue leve y que igual se trató como real, que es lo que se puede
> explicar en una auditoría. Subir la gravedad reescribe el hecho.
> Recomiendo mantener lo que está.

---

## 4 · Contradicciones dentro del propio documento

Tres cosas que el documento dice de dos formas distintas, y que alguien
tiene que resolver antes de programarlas:

1. **Los tramos de compensación.** El apartado 5 dice «hasta 50 % **y**
   Gs. 2.000.000» y «hasta 100 % **y** Gs. 6.000.000». El prompt del
   final dice «≤2M (Gestor), 2M–6M (Gerencia Comercial), >6M (Gerencia
   General)», sin porcentajes. ¿El porcentaje es un tope adicional o se
   ignora? Hoy el sistema aplica las dos condiciones.
2. **Las dos compensaciones en el año.** El apartado 5 dice **avisar**;
   el prompt dice **bloquear**. Avisar y bloquear son dos sistemas
   distintos y dos conversaciones distintas con el cliente.
3. **El umbral de la alerta por recurrencia.** «Si un área supera el 5 %
   de reclamos por reincidencia durante 2 meses consecutivos»: no dice
   5 % **de qué**. ¿De los reclamos de esa área? ¿Del total? ¿De las
   ventas del área? Con menos de 10 reclamos al mes, cualquiera de las
   tres da un número que se dispara con un solo caso.

---

## 5 · El entregable que pide el documento

### Tablas

**Existen, y alcanzan para casi todo:**

- **`reclamos`** — 44 columnas. El caso: cliente, descripción, origen,
  tipo de falla, gravedad, plan, estado, estado del cliente,
  responsable, reincidencia, rechazos, material controlado, trámite
  DIGEMABEL, las nueve fechas del circuito, la compensación con su
  autorización, y el vínculo a la no conformidad.
- **`reclamo_acciones`** — las tareas: qué, quién, para cuándo, cuándo
  se ejecutó.

**Harían falta:**

- **`reclamo_compensaciones`** — una fila por compensación, con cliente,
  factura, monto original, monto compensado, tramo que correspondió,
  quién autorizó y cuándo. Es lo que permite contar dos en el año y lo
  que hoy no se puede hacer porque la compensación vive dentro del
  reclamo.
- **`reclamo_accion_estados`** o un `estado` en `reclamo_acciones`, para
  que el área marque la tarea como cumplida y quede quién y cuándo.

### Estados del caso

Los seis que ya están, que cubren el flujo del documento con más
detalle: `registrado`, `contactado`, `plan_definido`, `resuelto`,
`cerrado`, `no_conciliado`. Las transiciones están cerradas: no se puede
saltar de registrado a cerrado.

### Pantallas

1. **Creación del caso** — existe. Cinco campos más el cliente, con la
   gravedad diciendo qué plan activa y qué plazos corren.
2. **Gestión del caso** — existe. Ficha con el estado, el paso
   siguiente, las acciones, la compensación y la verificación.
3. **Tablero del gestor** — **no existe.** Es la pantalla que falta: el
   listado con semáforo por plazo, el corte por área de origen y la
   serie mensual.

---

## 6 · Qué hay que decidir antes de programar

Cinco preguntas, por orden de importancia. Ninguna es técnica:

1. **¿Vuelve el Gestor del Caso al formulario?** Es la que más cambia el
   trabajo diario, y es la que se decidió al revés hace tres días.
2. **¿Vuelve «Material Controlado» como casilla obligatoria del alta?**
3. **¿La reincidencia sube la gravedad o el plan?**
4. **Compensaciones: ¿el porcentaje cuenta además del monto, y la
   tercera del año se avisa o se bloquea?**
5. **La alerta del 5 %: ¿5 % de qué, y sobre cuántos casos como mínimo
   tiene sentido calcularla?**

Con esas cinco respondidas, lo que queda es trabajo, no decisiones: los
diez puntos del apartado 2, en ese orden, con el tablero y la alerta de
recurrencia al final porque son los que dependen de todo lo demás.
