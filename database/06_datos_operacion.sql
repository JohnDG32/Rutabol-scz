-- Extra: datos de operación de demostración para poblar el dashboard.
-- En una instalación nueva se ejecuta automáticamente desde docker-entrypoint-initdb.d.
-- En una base ya creada:
--   docker compose exec -T postgres psql -U micros -d micros_scz -v ON_ERROR_STOP=1 -f /datos-operacion.sql
-- Es idempotente: se puede volver a ejecutar sin duplicar registros.
-- Todos los nombres, placas y referencias son ficticios.

INSERT INTO lineas (id, nombre, zona, descripcion, color) VALUES
  (9005, 'Linea Demo Rivera', 'Zona norte', 'Recorrido ficticio hacia el mercado de abasto.', '#0891b2'),
  (9006, 'Linea Demo Warnes', 'Zona noreste', 'Servicio ilustrativo de conexión con Warnes.', '#16a34a'),
  (9007, 'Linea Demo La Guardia', 'Zona sur', 'Ejemplo de recorrido metropolitano.', '#e11d48')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('lineas', 'id'), (SELECT MAX(id) FROM lineas));

INSERT INTO micros (id, placa, interno, capacidad, estado, autorizado, linea_id) VALUES
  (9004, 'DEMO-904', '904', 23, 'DISPONIBLE', TRUE, 9005),
  (9005, 'DEMO-905', '905', 21, 'DISPONIBLE', TRUE, 9006),
  (9006, 'DEMO-906', '906', 24, 'DISPONIBLE', TRUE, 9007),
  (9007, 'DEMO-907', '907', 20, 'FUERA_DE_SERVICIO', FALSE, 9007)
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('micros', 'id'), (SELECT MAX(id) FROM micros));

INSERT INTO tarifas (linea_id, categoria, monto)
SELECT l.id, c.categoria, c.monto
FROM lineas l
CROSS JOIN (VALUES ('GENERAL', 2.50), ('ESCOLAR', 1.50), ('UNIVERSITARIO', 1.80)) AS c(categoria, monto)
WHERE l.id BETWEEN 9005 AND 9007
ON CONFLICT (linea_id, categoria) WHERE activa DO NOTHING;

INSERT INTO conductores (id, nombre, apellido, ci, telefono, micro_id, activo) VALUES
  (9005, 'María', 'Quispe', 'CI-DEMO-9005', '70009005', 9004, TRUE),
  (9006, 'Carlos', 'Vargas', 'CI-DEMO-9006', '70009006', 9005, TRUE),
  (9007, 'Lucía', 'Peña', 'CI-DEMO-9007', '70009007', 9006, TRUE)
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('conductores', 'id'), (SELECT MAX(id) FROM conductores));

-- Viajes con IDs altos para no mezclarse con los que crea la prueba integral.
INSERT INTO viajes (id, micro_id, conductor_id, linea_id, tipo, estado, iniciado_en, finalizado_en) VALUES
  (9001, 9004, 9005, 9005, 'NORMAL', 'EN_CURSO', now() - interval '2 hours', NULL),
  (9002, 9005, 9006, 9006, 'NORMAL', 'EN_CURSO', now() - interval '45 minutes', NULL),
  (9003, 9006, 9007, 9007, 'NORMAL', 'FINALIZADO', now() - interval '1 day', now() - interval '22 hours')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('viajes', 'id'), (SELECT MAX(id) FROM viajes));

INSERT INTO pagos (id, usuario_id, viaje_id, monto, categoria, metodo, estado, referencia, creado_en, confirmado_en)
SELECT 9001, u.id, 9001, 2.50, 'GENERAL', 'SIMULADO', 'CONFIRMADO',
       'DEMO-OPER-9001', now() - interval '2 hours', now() - interval '2 hours'
  FROM usuarios u WHERE u.username = 'pasajero1'
UNION ALL
SELECT 9002, u.id, 9002, 1.80, 'UNIVERSITARIO', 'SIMULADO', 'CONFIRMADO',
       'DEMO-OPER-9002', now() - interval '45 minutes', now() - interval '40 minutes'
  FROM usuarios u WHERE u.username = 'estudiante1'
UNION ALL
SELECT 9003, NULL, 9003, 2.50, 'GENERAL', 'SIMULADO', 'CONFIRMADO',
       'DEMO-OPER-9003', now() - interval '1 day', now() - interval '23 hours'
UNION ALL
SELECT 9004, u.id, 9003, 1.50, 'ESCOLAR', 'SIMULADO', 'CONFIRMADO',
       'DEMO-OPER-9004', now() - interval '1 day', now() - interval '23 hours'
  FROM usuarios u WHERE u.username = 'pasajero1'
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('pagos', 'id'), (SELECT MAX(id) FROM pagos));

INSERT INTO abordajes (id, viaje_id, usuario_id, categoria, pago_id, estado, registrado_en)
SELECT 9001, 9001, u.id, 'GENERAL', 9001, 'A BORDO', now() - interval '2 hours'
  FROM usuarios u WHERE u.username = 'pasajero1'
UNION ALL
SELECT 9002, 9002, u.id, 'UNIVERSITARIO', 9002, 'A BORDO', now() - interval '45 minutes'
  FROM usuarios u WHERE u.username = 'estudiante1'
UNION ALL
SELECT 9003, 9003, u.id, 'ESCOLAR', 9004, 'BAJADO', now() - interval '1 day'
  FROM usuarios u WHERE u.username = 'pasajero1'
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('abordajes', 'id'), (SELECT MAX(id) FROM abordajes));

INSERT INTO posiciones (micro_id, lat, lng, origen, registrado_en)
SELECT 9004, -17.7833, -63.1821, 'SIMULADO', now() - interval '5 minutes'
WHERE NOT EXISTS (SELECT 1 FROM posiciones WHERE micro_id = 9004 AND lat = -17.7833 AND lng = -63.1821);
INSERT INTO posiciones (micro_id, lat, lng, origen, registrado_en)
SELECT 9004, -17.7845, -63.1810, 'SIMULADO', now() - interval '1 minute'
WHERE NOT EXISTS (SELECT 1 FROM posiciones WHERE micro_id = 9004 AND lat = -17.7845 AND lng = -63.1810);
INSERT INTO posiciones (micro_id, lat, lng, origen, registrado_en)
SELECT 9005, -17.7701, -63.1502, 'SIMULADO', now() - interval '4 minutes'
WHERE NOT EXISTS (SELECT 1 FROM posiciones WHERE micro_id = 9005 AND lat = -17.7701 AND lng = -63.1502);
INSERT INTO posiciones (micro_id, lat, lng, origen, registrado_en)
SELECT 9005, -17.7715, -63.1488, 'SIMULADO', now() - interval '1 minute'
WHERE NOT EXISTS (SELECT 1 FROM posiciones WHERE micro_id = 9005 AND lat = -17.7715 AND lng = -63.1488);
INSERT INTO posiciones (micro_id, lat, lng, origen, registrado_en)
SELECT 9006, -17.7420, -63.2205, 'SIMULADO', now() - interval '3 minutes'
WHERE NOT EXISTS (SELECT 1 FROM posiciones WHERE micro_id = 9006 AND lat = -17.7420 AND lng = -63.2205);
INSERT INTO posiciones (micro_id, lat, lng, origen, registrado_en)
SELECT 9006, -17.7432, -63.2191, 'SIMULADO', now() - interval '1 minute'
WHERE NOT EXISTS (SELECT 1 FROM posiciones WHERE micro_id = 9006 AND lat = -17.7432 AND lng = -63.2191);

SELECT setval(pg_get_serial_sequence('posiciones', 'id'), (SELECT MAX(id) FROM posiciones));
