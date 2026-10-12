-- Tope porcentual de la compensacion: se hace cumplir, no solo se avisa
--
-- El procedimiento de reclamos define tres tramos de autorizacion por
-- monto, y cada uno lleva ademas un tope sobre el valor de la factura
-- afectada: hasta Gs. 2.000.000 el tope es el 50 %, hasta Gs. 6.000.000
-- el 100 %, y por encima no hay tope porcentual porque ya exige la
-- cofirma de Gerencia.
--
-- Hasta hoy el porcentaje se calculaba y se mostraba en pantalla, pero
-- nada impedia guardar una compensacion que lo excediera. Calidad
-- confirmo el 12 de octubre que LOS DOS LIMITES SON CANDADOS
-- SIMULTANEOS y que vale el que se alcance primero: una compensacion de
-- Gs. 2.000.000 sobre una factura de Gs. 2.500.000 esta dentro del monto
-- del primer tramo y es el 80 % de la factura, asi que no corresponde.
--
-- CONSECUENCIA QUE CONVIENE TENER PRESENTE: el tope viaja con el tramo,
-- y el tramo lo decide el monto. Una compensacion mayor cae en el tramo
-- siguiente, donde el tope es el 100 %. No es que «mas sea mas facil»:
-- es que ese monto ya no lo firma el Supervisor sino el Jefe del Canal.
-- El caso del ejemplo no se destraba subiendo el monto; se baja la
-- compensacion a Gs. 1.250.000 o se la asume como perdida sin compensar.
--
-- POR QUE EXIGE EL MONTO DE LA FACTURA: sin el no hay porcentaje que
-- calcular, y dejar pasar la compensacion porque falta el divisor es
-- justo lo contrario de un candado. La aplicacion ya lo pide con ese
-- mensaje; esto lo sostiene desde la base.
--
-- La misma regla vive en `excedeTopePorcentual()` de `lib/reclamos.ts`.
-- Si Calidad cambia los tramos, cambia en los dos lados.

alter table public.reclamos
  add constraint reclamos_tope_porcentual check (
    compensacion_monto is null
    or compensacion_monto <= 0
    or case
         when compensacion_monto <= 2000000 then
           monto_factura is not null
           and monto_factura > 0
           and compensacion_monto <= monto_factura * 0.5
         when compensacion_monto <= 6000000 then
           monto_factura is not null
           and monto_factura > 0
           and compensacion_monto <= monto_factura
         else true
       end
  );

comment on constraint reclamos_tope_porcentual on public.reclamos is
  'Tope porcentual del tramo de autorizacion, sobre el monto de la factura '
  'afectada: 50 % hasta Gs. 2.000.000 y 100 % hasta Gs. 6.000.000. Por '
  'encima no hay tope porcentual porque ya exige cofirma de Gerencia.';
