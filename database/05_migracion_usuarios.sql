-- Extra: dashboard y gestión de usuarios.
-- En una instalación nueva no hace falta: 01_init.sql ya incluye la columna.
-- Para una base ya creada:
--   docker compose exec -T postgres psql -U micros -d micros_scz -v ON_ERROR_STOP=1 -f /usuarios-migration.sql

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

-- Los usuarios existentes se mantienen activos para no romper las pruebas base.
UPDATE usuarios SET activo = TRUE WHERE activo IS NULL;
