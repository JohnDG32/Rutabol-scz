-- Extra: pasarela Stripe (modo sandbox opcional).
-- Se aplica sobre una base creada con 01_init.sql / 02_migracion_rutabol.sql.
-- En una instalación nueva no hace falta: esos archivos ya incluyen estos cambios.

ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_metodo_check;
ALTER TABLE pagos ADD CONSTRAINT pagos_metodo_check
  CHECK (metodo IN ('SIMULADO', 'TARJETA', 'STRIPE'));

ALTER TABLE pagos ADD COLUMN IF NOT EXISTS stripe_sesion_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_pagos_stripe_sesion ON pagos(stripe_sesion_id);
