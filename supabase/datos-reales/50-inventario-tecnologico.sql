-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Inventario de activos tecnologicos
-- =====================================================================
-- Las ochenta y cuatro filas cargadas de la planilla "INVENTARIO
-- TECNOLOGICO" de la unidad compartida de TI, ultima actualizacion del
-- 2 de junio de 2026, responsable Facundo Colman.
--
-- Sofidya no los tiene: `get_assets` devuelve cero para las dos sedes.
-- Este es el inventario que se lleva de verdad.
--
-- La planilla tiene ademas seis hojas por area (ADM, CHUM, MAY, MKT,
-- REU, REC/REG, CAJ, DEP, SAL) que son plantillas a medio llenar: casi
-- todas las celdas dicen "[Completar]" y repiten equipos que ya estan
-- en la primera hoja. NO se cargan. Volcarlas seria meter relleno con
-- forma de dato, y ademas duplicaria activos.
--
-- Una fila de la planilla no tiene codigo -- la notebook HP Victus de
-- Martin Benitez, Jefe de Marketing -- y el esquema lo exige. Queda
-- afuera hasta que TI le asigne uno.
--
-- El encabezado de la planilla dice "Proceso: MP-APY-02 Infraestructura
-- y Tecnologia". Esa codificacion es anterior: en el mapa vigente ese
-- proceso es MP-SOP-02. Los activos se cuelgan del proceso por su
-- codigo actual.
--
-- Equivalencia de estados:
--   Operativo   -> operativo
--   Reparacion  -> en_mantenimiento
--   Baja        -> dado_de_baja
--   Libre       -> operativo, y "Sin asignar" en la descripcion, porque
--                  el equipo anda: lo que no tiene es a quien
--
-- A quien esta asignado cada equipo va en la descripcion y no en
-- `responsable_id`: la mayoria de esas personas todavia no tiene cuenta
-- en la intranet, y no se les inventa una.
--
-- Se aplica DESPUES del seed. Es idempotente.

do $$
declare
  v_empresa uuid;
  r record;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    raise exception 'No hay ninguna empresa cargada. Aplique el seed primero.';
  end if;

  for r in
    select * from (values
  ('C44-NB-000', 'Notebook Dell inspiron', 'Notebook', 'Dell', 'inspiron', '0768567E-1527-4F05-9365-581D1C27D4A8', 'operativo', 'Asignado a: Irene Livieres. Color: Gris oscuro'),
  ('C44-NB-001', 'Notebook HP Precision 7510', 'Notebook', 'HP', 'Precision 7510', '00330-80180-35975-AA577', 'dado_de_baja', 'Color: Rojo'),
  ('C44-NB-002', 'Notebook HP HP Laptop 15-dy1xxx', 'Notebook', 'HP', 'HP Laptop 15-dy1xxx', '00330-80000-00000-AA258', 'operativo', 'Asignado a: OSCAR DAVID NOGUERA. Color: Plateado'),
  ('C44-NB-003', 'Notebook Dell Precision 7510', 'Notebook', 'Dell', 'Precision 7510', '00330-80180-35875-AA652', 'operativo', 'Asignado a: Adan -DIG 2. Color: Negro'),
  ('C44-NB-004', 'Notebook HP 15-dy1xxx', 'Notebook', 'HP', '15-dy1xxx', 'A4112A0C-AE34-4824-9A3E-F60DF07B750E', 'dado_de_baja', 'Color: Plateado'),
  ('C44-NB-005', 'Notebook HP 15-dy2xxx', 'Notebook', 'HP', '15-dy2xxx', '00330-80000-00000-AA665', 'operativo', 'Asignado a: Oscar Zárate. Color: Plateado'),
  ('C44-NB-006', 'Notebook HP HP 250 G5', 'Notebook', 'HP', 'HP 250 G5', '72A804E3-4949-4DD1-B736-888968B26AD2', 'operativo', 'Asignado a: Cesar Aguilera. Color: Negro'),
  ('C44-NB-007', 'Notebook Lenovo 81WE', 'Notebook', 'Lenovo', '81WE', '00330-80000-00000-AA895', 'operativo', 'Asignado a: Salón. Color: Azul'),
  ('C44-NB-008', 'Notebook ASUS X1504ZA-X1504ZA', 'Notebook', 'ASUS', 'X1504ZA-X1504ZA', '0330-80000-00000-AA069', 'en_mantenimiento', 'Asignado a: Hugo González. Color: Azul'),
  ('C44-NB-009', 'Notebook ASUS X1504ZA-X1504ZA', 'Notebook', 'ASUS', 'X1504ZA-X1504ZA', '0330-80000-00000-AA03', 'operativo', 'Asignado a: Carlos Gonzalez. Color: Azul'),
  ('C44-NB-010', 'Notebook HP 15-dy1xxx', 'Notebook', 'HP', '15-dy1xxx', '00330-81814-80131-AA0EM', 'operativo', 'Asignado a: Alicia. Color: Plateado'),
  ('C44-NB-011', 'Notebook Asus VivoBook', 'Notebook', 'Asus', 'VivoBook', '00330-80000-00000-AA653', 'operativo', 'Asignado a: Lucas Álvarez. Color: Negro'),
  ('C44-NB-012', 'Notebook HP 3168NGW', 'Notebook', 'HP', '3168NGW', '00330-80180-35975-AA577', 'operativo', 'Asignado a: Bianca. Color: Gris/Plata'),
  ('C44-NB-017', 'Notebook Dell inspiron 15 3000', 'Notebook', 'Dell', 'inspiron 15 3000', null, 'operativo', 'Asignado a: Sergio Divano'),
  ('C44-NB-019', 'Notebook HP Envy', 'Notebook', 'HP', 'Envy', '0330-80000-00000-AA056', 'operativo', 'Asignado a: Alejandro Rahi. Color: Plateado'),
  ('C44-NB-020', 'Notebook MSI MS-16W2', 'Notebook', 'MSI', 'MS-16W2', 'CD54D0A1-8F3D-4DF2-A1AE-1F172171EE13', 'operativo', 'Asignado a: Marketing'),
  ('C44-NB-021', 'Notebook HP 15-dy2xxx', 'Notebook', 'HP', '15-dy2xxx', '00330-80000-000-AA708', 'dado_de_baja', 'Color: Gris/Plata'),
  ('C44-NB-022', 'Notebook Dell Precision 7510', 'Notebook', 'Dell', 'Precision 7510', '00330-80180-3597-AA577', 'operativo', 'Asignado a: Créditos. Color: Negra'),
  ('C44-NB-023', 'Notebook Lenovo B1WE', 'Notebook', 'Lenovo', 'B1WE', '6C063E9A-64F0-450D-83B2-6BA39BA2B1FF', 'operativo', 'Asignado a: Venta Salón'),
  ('C44-NB-024', 'Notebook HP 15-dy2061la', 'Notebook', 'HP', '15-dy2061la', 'ACC5F835-78AE-442A-B0EE-416F45317645', 'dado_de_baja', 'Color: Gris'),
  ('C44-NB-025', 'Notebook Lenovo IdeaPad 1 15', 'Notebook', 'Lenovo', 'IdeaPad 1 15', 'PF5TK2FN', 'operativo', 'Asignado a: Fabricio. Color: Plateado'),
  ('C44-NB-026', 'Notebook Lenovo IdeaPad 1 15', 'Notebook', 'Lenovo', 'IdeaPad 1 15', null, 'operativo', 'Asignado a: Facundo Colman. Color: Plateado'),
  ('C44-NB-027', 'Notebook Lenovo IdeaPad 1 15', 'Notebook', 'Lenovo', 'IdeaPad 1 15', null, 'operativo', 'Asignado a: Roque. Color: Plateado'),
  ('C44-NB-028', 'Notebook ASUS TUF DASH F15', 'Notebook', 'ASUS', 'TUF DASH F15', 'N5BRCX02Y14920D', 'operativo', 'Asignado a: Derlis. Color: Negro'),
  ('C44-NB-029', 'Notebook Lenovo IdeaPad 1 15', 'Notebook', 'Lenovo', 'IdeaPad 1 15', null, 'operativo', 'Asignado a: Ruth Dige. Color: Plateado'),
  ('C44-NB-030', 'Notebook Lenovo IdeaPad 1 15', 'Notebook', 'Lenovo', 'IdeaPad 1 15', 'PF5SJMJR', 'operativo', 'Color: Plateado. Sin asignar'),
  ('C44-NB-031', 'Notebook Asus Vivobook', 'Notebook', 'Asus', 'Vivobook', 'S6N0CX04W01024A', 'operativo', 'Asignado a: Ruth Aquino. Color: Negro/Azul Oscuro'),
  ('C44-NB-032', 'Notebook Lenovo IdeaPad 1 15', 'Notebook', 'Lenovo', 'IdeaPad 1 15', 'PF5RPXEX', 'operativo', 'Asignado a: Araceli. Color: Plateado'),
  ('C44-PCE-001', 'CPU', 'CPU', null, null, null, 'operativo', 'Sin asignar'),
  ('C44-PCE-002', 'CPU', 'CPU', null, null, null, 'operativo', 'Asignado a: Eugenia Villalba'),
  ('C44-PCE-003', 'CPU', 'CPU', null, null, null, 'operativo', 'Asignado a: Contabilidad'),
  ('C44-PCE-004', 'CPU', 'CPU', null, null, null, 'operativo', 'Asignado a: David Palacio'),
  ('C44-PCE-005', 'CPU', 'CPU', null, null, null, 'operativo', 'Asignado a: Julia Olmedo'),
  ('C44-PCE-006', 'CPU', 'CPU', null, null, null, 'operativo', 'Asignado a: Yasmina Barranco'),
  ('C44-MOV-001', 'Celular Iphone 13 256GB', 'Celular', null, 'Iphone 13 256GB', 'K73052XQYP', 'operativo', 'Asignado a: Hugo González · Vitálica'),
  ('C44-MOV-002', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60K2XRK', 'operativo', 'Sin asignar'),
  ('C44-MOV-004', 'Tablet Samsung Galaxy TAB A7', 'Tablet', null, 'Samsung Galaxy TAB A7', null, 'dado_de_baja', null),
  ('C44-MOV-005', 'Tablet Samsung Galaxy Tab A7', 'Tablet', null, 'Samsung Galaxy Tab A7', null, 'dado_de_baja', null),
  ('C44-MOV-006', 'Tablet Blackview tab9', 'Tablet', null, 'Blackview tab9', 'Tab9WNEU0000850', 'dado_de_baja', null),
  ('C44-MOV-007', 'Tablet Blackview tab9', 'Tablet', null, 'Blackview tab9', 'tab9WNEU0006243', 'dado_de_baja', null),
  ('C44-MOV-008', 'POS MODEL T6M', 'POS', null, 'MODEL T6M', 'P652000020210', 'operativo', 'Asignado a: Smart Mobile POS · Vitálica. Sin asignar'),
  ('C44-MOV-009', 'POS MODEL T6M', 'POS', null, 'MODEL T6M', 'P652000022168', 'operativo', 'Asignado a: Smart Mobile POS · Vitálica · Caja'),
  ('C44-MOV-010', 'Celular Xiaomi Redmi 9A', 'Celular', null, 'Xiaomi Redmi 9A', '29227/60U878472', 'dado_de_baja', null),
  ('C44-MOV-011', 'Celular Iphone 13 Pro', 'Celular', null, 'Iphone 13 Pro', 'M7H02T7LWC', 'operativo', 'Asignado a: Corporativo de Marketing'),
  ('C44-MOV-012', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC03799', 'operativo', 'Asignado a: Oscar David Maldonado Yudis'),
  ('C44-MOV-013', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61745/R5U501153', 'operativo', 'Asignado a: Jhamyl Daniel Insfrán Núñez'),
  ('C44-MOV-015', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61745/R5U501070', 'operativo', null),
  ('C44-MOV-016', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC03918', 'operativo', 'Asignado a: Oscar Daniel Zárate Villamayor'),
  ('C44-MOV-017', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61686/R5UC03927', 'operativo', 'Asignado a: Marcelo Evaristo Sánchez Rojas'),
  ('C44-MOV-018', 'Celular Samsung M11', 'Celular', null, 'Samsung M11', 'R9JN70W9C0J', 'operativo', 'Asignado a: Logística'),
  ('C44-MOV-019', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC03807', 'operativo', null),
  ('C44-MOV-021', 'Celular Samsung Galaxy A15', 'Celular', null, 'Samsung Galaxy A15', 'RF8X50BTQ5A', 'operativo', 'Asignado a: Jorge Rodríguez'),
  ('C44-MOV-022', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60K3RDK', 'operativo', 'Asignado a: Capital Humano'),
  ('C44-MOV-023', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC04011', 'operativo', 'Asignado a: Hugo Javier González Arce'),
  ('C44-MOV-024', 'Celular Samsung A14', 'Celular', null, 'Samsung A14', 'R5CWB25JEKK', 'operativo', null),
  ('C44-MOV-025', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC03883', 'dado_de_baja', null),
  ('C44-MOV-026', 'Celular Samsung Galaxy A14', 'Celular', null, 'Samsung Galaxy A14', 'R58W60T09YL', 'operativo', null),
  ('C44-MOV-027', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC01422', 'operativo', null),
  ('C44-MOV-028', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61745/R5U501194', 'operativo', 'Asignado a: Marcelo Evaristo Sánchez Rojas'),
  ('C44-MOV-029', 'Celular Samsung M11', 'Celular', null, 'Samsung M11', 'R9JN716VH9J', 'dado_de_baja', null),
  ('C44-MOV-030', 'Celular Samsung A14', 'Celular', null, 'Samsung A14', 'R58W60SZAQM', 'operativo', 'Asignado a: Juan Severo Del Puerto Prieto'),
  ('C44-MOV-031', 'Celular Samsung A14', 'Celular', null, 'Samsung A14', 'R58W50E9R2F', 'operativo', 'Asignado a: Bernardo Sosa Garay'),
  ('C44-MOV-032', 'Celular Samsung M11', 'Celular', null, 'Samsung M11', 'R9JN716VHCJ', 'operativo', 'Asignado a: Rodolfo Cohene Tabare'),
  ('C44-MOV-033', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X302WPDB', 'operativo', 'Asignado a: Jhamyl Daniel Insfrán Núñez'),
  ('C44-MOV-034', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60K4GYH', 'operativo', 'Asignado a: Adan Feliciano Candia Aveiro'),
  ('C44-MOV-035', 'Celular Samsung Galaxy A15', 'Celular', null, 'Samsung Galaxy A15', 'RF8X50G8KNK', 'operativo', 'Asignado a: María Julia Olmedo Cuevas'),
  ('C44-MOV-036', 'Celular Xiaomi Redmi 9A', 'Celular', null, 'Xiaomi Redmi 9A', '31271/11TS01634', 'dado_de_baja', null),
  ('C44-MOV-037', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X50G83AL', 'operativo', 'Asignado a: Lucas Álvarez'),
  ('C44-MOV-038', 'Celular Xiaomi Redmi 9A', 'Celular', null, 'Xiaomi Redmi 9A', 'AYLB854H6LCMJF4H', 'dado_de_baja', null),
  ('C44-MOV-040', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60K2DVX', 'operativo', null),
  ('C44-MOV-041', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60HWM4D', 'operativo', null),
  ('C44-MOV-042', 'Celular Xiaomi Redmi 9A', 'Celular', null, 'Xiaomi Redmi 9A', '31271/11TS00263', 'operativo', 'Asignado a: Carlos Gustavo Sosa Aranda'),
  ('C44-MOV-043', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60K2YZH', 'operativo', null),
  ('C44-MOV-044', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC03778', 'operativo', 'Asignado a: Antonio de Jesús Fernández Benítez'),
  ('C44-MOV-045', 'Celular Xiaomi Redmi 9A', 'Celular', null, 'Xiaomi Redmi 9A', '29227/60U878534', 'operativo', 'Asignado a: Cesar Alejandro Rahi Geraghty'),
  ('C44-MOV-046', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60K2H7V', 'operativo', null),
  ('C44-MOV-047', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60HWSZT', 'operativo', 'Asignado a: Mario Esteban Penayo Bogado'),
  ('C44-MOV-048', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X50G7HEH', 'operativo', 'Asignado a: Administración'),
  ('C44-MOV-053', 'Tablet Samsung Galaxy Tab A7', 'Tablet', null, 'Samsung Galaxy Tab A7', null, 'operativo', 'Asignado a: Antonio'),
  ('C44-MOV-054', 'Celular Samsung Galaxy A15', 'Celular', null, 'Samsung Galaxy A15', 'RF8X302GRZP', 'operativo', 'Asignado a: Roque Mendez'),
  ('C44-MOV-056', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC04015', 'operativo', null),
  ('C44-MOV-057', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC03717', 'operativo', 'Asignado a: Yasmin Araceli Pereira Ovelar · NPS'),
  ('C44-MOV-058', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61745/R5U500521', 'operativo', 'Sin asignar'),
  ('C44-MOV-059', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61745/R5U501176', 'operativo', 'Sin asignar')
    ) as t(codigo, nombre, tipo, marca, modelo, serie, estado, detalle)
  loop
    insert into public.activos (
      empresa_id, codigo, nombre, categoria, marca, modelo,
      numero_serie, estado, descripcion, es_demostracion
    ) values (
      v_empresa, r.codigo, r.nombre, r.tipo, r.marca, r.modelo,
      r.serie, r.estado::public.estado_activo, r.detalle, false
    )
    on conflict (empresa_id, upper(codigo)) do update set
      nombre = excluded.nombre,
      categoria = excluded.categoria,
      marca = excluded.marca,
      modelo = excluded.modelo,
      numero_serie = excluded.numero_serie,
      estado = excluded.estado,
      descripcion = excluded.descripcion,
      es_demostracion = false;
  end loop;
end;
$$;
