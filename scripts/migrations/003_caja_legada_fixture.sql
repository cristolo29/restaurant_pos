-- FIXTURE DE PRUEBA (no es una migración): reproduce la tabla orbezo.caja heredada que existe en
-- producción (0 filas) y orbezo.pago, que la referencia. Reconstruida a mano a partir de las columnas
-- y constraints reportadas (tipos supuestos: NUMERIC(10,2) para montos, TIMESTAMPTZ para fechas).
-- Uso: solo en bases temporales, después de scripts/init_db.sql previo a la 003.
CREATE TABLE orbezo.caja (
    id             SERIAL PRIMARY KEY,
    usuario_id     INTEGER NOT NULL,
    monto_apertura NUMERIC(10,2) NOT NULL DEFAULT 0,
    monto_cierre   NUMERIC(10,2),
    total_efectivo NUMERIC(10,2) DEFAULT 0,
    total_tarjeta  NUMERIC(10,2) DEFAULT 0,
    total_yape     NUMERIC(10,2) DEFAULT 0,
    total_plin     NUMERIC(10,2) DEFAULT 0,
    total_otros    NUMERIC(10,2) DEFAULT 0,
    observacion    TEXT,
    estado         VARCHAR(20) NOT NULL DEFAULT 'abierta',
    apertura_en    TIMESTAMPTZ DEFAULT NOW(),
    cierre_en      TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT caja_estado_check CHECK (estado IN ('abierta','cerrada')),
    CONSTRAINT caja_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES orbezo.usuario(id)
);
CREATE TABLE orbezo.pago (
    id        SERIAL PRIMARY KEY,
    caja_id   INTEGER,
    monto     NUMERIC(10,2),
    CONSTRAINT pago_caja_id_fkey FOREIGN KEY (caja_id) REFERENCES orbezo.caja(id)
);
