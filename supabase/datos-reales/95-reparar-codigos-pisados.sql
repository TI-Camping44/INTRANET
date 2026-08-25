-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Reparar los codigos que piso la importacion de Sofidya
-- =====================================================================
-- La primera version de la importacion escribia el codigo tambien al
-- actualizar. Cuando un puesto de Sofidya coincidia de nombre con uno ya
-- cargado, le pisaba el codigo real con uno derivado del identificador
-- interno de Sofidya: el perfil P-101 del formulario R-02-01 quedaba
-- como SOF-P-31.
--
-- El codigo de la importacion ya no lo hace: ahora el codigo se escribe
-- solo al crear la fila. Esto repara lo que alcanzo a pisarse antes.
--
-- Es idempotente y no hace nada si no hay nada roto: solo toca filas
-- cuyo codigo empieza con SOF- y cuyo nombre coincide con uno de los
-- registros conocidos, y solo si el codigo verdadero esta libre.

do $$
declare
  v_empresa uuid;
  r record;
  v_id uuid;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    return;
  end if;

  -- -------------------------------------------------------------------
  -- Puestos: los nueve perfiles del formulario R-02-01
  -- -------------------------------------------------------------------
  for r in
    select * from (values
      ('P-101', 'Jefe de Logística'),
      ('P-102', 'Responsable IT'),
      ('P-103', 'Asistente de Logística Mayorista'),
      ('P-104', 'Asistente de Gestiones'),
      ('P-105', 'Gestor de Cobranzas y Entregas'),
      ('P-106', 'Asistente Técnico'),
      ('P-107', 'Asistente de Control de Stock 1'),
      ('P-108', 'Asistente de Control de Stock 2'),
      ('P-109', 'Asistente de Reposición de Stock')
    ) as t(codigo, nombre)
  loop
    -- Si el codigo verdadero sigue en su lugar, no hay nada que reparar.
    continue when exists (
      select 1 from public.puestos
       where empresa_id = v_empresa and lower(codigo) = lower(r.codigo));

    select id into v_id from public.puestos
     where empresa_id = v_empresa
       and nombre = r.nombre
       and codigo like 'SOF-%'
     order by creado_en
     limit 1;

    if v_id is not null then
      update public.puestos set codigo = r.codigo where id = v_id;
      raise notice 'Puesto "%" recupero su codigo %.', r.nombre, r.codigo;
    end if;
  end loop;

  -- -------------------------------------------------------------------
  -- Proveedores del seed
  -- -------------------------------------------------------------------
  for r in
    select * from (values
      ('PRV-001', 'Importadora Andina de Equipamiento S.A.'),
      ('PRV-002', 'Distribuidora de Municiones del Sur Ltda.'),
      ('PRV-003', 'Transportes Ñemity S.R.L.'),
      ('PRV-004', 'Insumos Gráficos Paraguay S.A.'),
      ('PRV-005', 'Servicios Informáticos Aguará S.R.L.')
    ) as t(codigo, razon_social)
  loop
    continue when exists (
      select 1 from public.proveedores
       where empresa_id = v_empresa and upper(codigo) = upper(r.codigo));

    select id into v_id from public.proveedores
     where empresa_id = v_empresa
       and razon_social = r.razon_social
       and codigo like 'SOF-%'
     order by creado_en
     limit 1;

    if v_id is not null then
      update public.proveedores set codigo = r.codigo where id = v_id;
      raise notice 'Proveedor "%" recupero su codigo %.', r.razon_social, r.codigo;
    end if;
  end loop;
end;
$$;
