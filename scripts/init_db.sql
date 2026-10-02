-- Script de inicialización — se ejecuta solo si la BD está vacía (primer arranque)

CREATE SCHEMA IF NOT EXISTS orbezo;

-- Roles
CREATE TABLE IF NOT EXISTS orbezo.rol (
    id       SERIAL PRIMARY KEY,
    nombre   VARCHAR(50) UNIQUE NOT NULL,
    permisos JSONB NOT NULL DEFAULT '{}',
    activo   BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO orbezo.rol (nombre, permisos, activo) VALUES
    ('admin',    '{}', true),
    ('cajero',   '{}', true),
    ('mozo',     '{}', true),
    ('cocinero', '{}', true)
ON CONFLICT (nombre) DO NOTHING;

-- Usuarios
CREATE TABLE IF NOT EXISTS orbezo.usuario (
    id            SERIAL PRIMARY KEY,
    rol_id        INTEGER NOT NULL REFERENCES orbezo.rol(id),
    nombre        VARCHAR(100) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    pin           VARCHAR(255),  -- hash scrypt (app/pinhash.py); nunca el PIN en claro
    activo        BOOLEAN NOT NULL DEFAULT true
);

-- Usuario admin semilla: se crea SIN PIN (nadie puede entrar hasta asignarlo; no hay PIN por defecto).
-- Para habilitarlo genera el hash (el PIN no es reversible) y actualízalo:
--   python -m app.pinhash 1234          -- imprime scrypt$16384$8$1$...
--   UPDATE orbezo.usuario SET pin = '<hash>' WHERE email = 'admin@orbezo.com';
INSERT INTO orbezo.usuario (rol_id, nombre, email, password_hash, pin, activo)
SELECT r.id, 'Administrador', 'admin@orbezo.com', 'sin_password', NULL, true
FROM orbezo.rol r WHERE r.nombre = 'admin'
ON CONFLICT (email) DO NOTHING;

-- Salones
CREATE TABLE IF NOT EXISTS orbezo.salon (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(80) NOT NULL,
    descripcion VARCHAR,
    activo      BOOLEAN DEFAULT true,
    CONSTRAINT uq_salon_nombre UNIQUE (nombre)
);

INSERT INTO orbezo.salon (nombre, activo) VALUES
    ('Salón principal', true),
    ('Terraza',         true)
ON CONFLICT DO NOTHING;

-- Mesas
CREATE TABLE IF NOT EXISTS orbezo.mesa (
    id        SERIAL PRIMARY KEY,
    salon_id  INTEGER NOT NULL,
    numero    VARCHAR(10) NOT NULL,
    capacidad INTEGER DEFAULT 4,
    estado    VARCHAR(20) NOT NULL DEFAULT 'disponible',
    CONSTRAINT fk_mesa_salon FOREIGN KEY (salon_id) REFERENCES orbezo.salon(id) ON DELETE RESTRICT,
    CONSTRAINT uq_mesa_salon_numero UNIQUE (salon_id, numero),
    CONSTRAINT ck_mesa_estado CHECK (estado IN ('disponible','ocupada','reservada')),
    CONSTRAINT ck_mesa_capacidad CHECK (capacidad > 0)
);

-- Categorías
CREATE TABLE IF NOT EXISTS orbezo.categoria (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(80) NOT NULL,
    descripcion VARCHAR,
    activo      BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_categoria_nombre UNIQUE (nombre)
);

INSERT INTO orbezo.categoria (nombre, activo) VALUES
    ('Entradas',  true),
    ('Fondos',    true),
    ('Bebidas',   true),
    ('Postres',   true)
ON CONFLICT DO NOTHING;

-- Productos
CREATE TABLE IF NOT EXISTS orbezo.producto (
    id           SERIAL PRIMARY KEY,
    categoria_id INTEGER NOT NULL REFERENCES orbezo.categoria(id),
    nombre       VARCHAR(120) NOT NULL,
    precio       NUMERIC(10,2) NOT NULL,
    disponible   BOOLEAN NOT NULL DEFAULT true,
    afecto_igv   BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT ck_producto_precio CHECK (precio >= 0)
);

-- Series de comprobantes
CREATE TABLE IF NOT EXISTS orbezo.serie_comprobante (
    id          SERIAL PRIMARY KEY,
    tipo        VARCHAR(10) NOT NULL,
    serie       VARCHAR(4) NOT NULL,
    correlativo INTEGER NOT NULL DEFAULT 1,
    activo      BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_serie_tipo_serie UNIQUE (tipo, serie),
    CONSTRAINT ck_serie_tipo CHECK (tipo IN ('boleta','factura'))
);

INSERT INTO orbezo.serie_comprobante (tipo, serie, correlativo, activo) VALUES
    ('boleta',  'B001', 1, true),
    ('factura', 'F001', 1, true)
ON CONFLICT DO NOTHING;

-- Pedidos
CREATE TABLE IF NOT EXISTS orbezo.pedido (
    id         SERIAL PRIMARY KEY,
    mesa_id    INTEGER NOT NULL REFERENCES orbezo.mesa(id),
    usuario_id INTEGER NOT NULL REFERENCES orbezo.usuario(id),
    estado     VARCHAR(20) DEFAULT 'abierto',
    tipo       VARCHAR(20) DEFAULT 'en_mesa',
    subtotal   NUMERIC(10,2) DEFAULT 0,
    igv        NUMERIC(10,2) DEFAULT 0,
    total      NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    anulado_por      INTEGER,
    anulado_at       TIMESTAMPTZ,
    motivo_anulacion VARCHAR(200),
    CONSTRAINT fk_pedido_anulado_por FOREIGN KEY (anulado_por) REFERENCES orbezo.usuario(id),
    CONSTRAINT ck_pedido_anulacion CHECK (estado <> 'anulado' OR motivo_anulacion IS NOT NULL),
    CONSTRAINT ck_pedido_estado CHECK (estado IN ('abierto','cerrado','anulado')),
    CONSTRAINT ck_pedido_tipo CHECK (tipo IN ('en_mesa','para_llevar','delivery')),
    CONSTRAINT ck_pedido_montos CHECK (subtotal >= 0 AND igv >= 0 AND total >= 0)
);

-- Un solo pedido abierto por mesa
CREATE UNIQUE INDEX IF NOT EXISTS uq_pedido_abierto_por_mesa
    ON orbezo.pedido (mesa_id) WHERE estado = 'abierto';

-- Items de pedido
CREATE TABLE IF NOT EXISTS orbezo.pedido_item (
    id          SERIAL PRIMARY KEY,
    pedido_id   INTEGER NOT NULL REFERENCES orbezo.pedido(id),
    producto_id INTEGER NOT NULL REFERENCES orbezo.producto(id),
    cantidad    INTEGER NOT NULL DEFAULT 1,
    precio_unit NUMERIC(10,2) NOT NULL,
    subtotal    NUMERIC(10,2) NOT NULL,
    estado      VARCHAR(20) DEFAULT 'pendiente',
    nota        VARCHAR,
    cancelado_por      INTEGER,
    cancelado_at       TIMESTAMPTZ,
    motivo_cancelacion VARCHAR(200),
    CONSTRAINT fk_pedido_item_cancelado_por FOREIGN KEY (cancelado_por) REFERENCES orbezo.usuario(id),
    CONSTRAINT ck_pedido_item_cancelacion CHECK (estado <> 'cancelado' OR motivo_cancelacion IS NOT NULL),
    CONSTRAINT ck_pedido_item_estado CHECK (estado IN ('pendiente','en_preparacion','listo','entregado','cancelado')),
    CONSTRAINT ck_pedido_item_cantidad CHECK (cantidad > 0),
    CONSTRAINT ck_pedido_item_montos CHECK (precio_unit >= 0 AND subtotal >= 0)
);

-- Comprobantes
CREATE TABLE IF NOT EXISTS orbezo.comprobante (
    id                SERIAL PRIMARY KEY,
    pedido_id         INTEGER NOT NULL REFERENCES orbezo.pedido(id),
    usuario_id        INTEGER NOT NULL REFERENCES orbezo.usuario(id),
    serie_id          INTEGER NOT NULL REFERENCES orbezo.serie_comprobante(id),
    tipo              VARCHAR(20) NOT NULL,
    serie             VARCHAR(4) NOT NULL,
    correlativo       INTEGER NOT NULL,
    tipo_doc_cliente  VARCHAR(10) DEFAULT '1',
    metodo_pago       VARCHAR(20) DEFAULT 'efectivo',
    monto_pagado      NUMERIC(10,2) DEFAULT 0,
    vuelto            NUMERIC(10,2) DEFAULT 0,
    nro_doc_cliente   VARCHAR(15),
    razon_social      VARCHAR(200),
    direccion_cliente VARCHAR,
    subtotal          NUMERIC(10,2) NOT NULL,
    igv               NUMERIC(10,2) NOT NULL,
    descuento         NUMERIC(10,2) DEFAULT 0,
    total             NUMERIC(10,2) NOT NULL,
    estado_sunat      VARCHAR(20) DEFAULT 'pendiente',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ck_comprobante_tipo CHECK (tipo IN ('boleta','factura')),
    CONSTRAINT ck_comprobante_metodo_pago CHECK (metodo_pago IN ('efectivo','tarjeta','yape','plin')),
    CONSTRAINT uq_comprobante_serie_correlativo UNIQUE (serie, correlativo),
    CONSTRAINT uq_comprobante_pedido UNIQUE (pedido_id),
    CONSTRAINT ck_comprobante_montos CHECK (subtotal >= 0 AND igv >= 0 AND descuento >= 0 AND total >= 0 AND monto_pagado >= 0 AND vuelto >= 0)
);

-- Items de comprobante
CREATE TABLE IF NOT EXISTS orbezo.comprobante_item (
    id             SERIAL PRIMARY KEY,
    comprobante_id INTEGER NOT NULL REFERENCES orbezo.comprobante(id),
    descripcion    VARCHAR(250) NOT NULL,
    cantidad       NUMERIC(10,3) NOT NULL,
    precio_unit    NUMERIC(10,4) NOT NULL,
    subtotal       NUMERIC(10,2) NOT NULL,
    igv_item       NUMERIC(10,2) NOT NULL DEFAULT 0,
    CONSTRAINT ck_comprobante_item_cantidad CHECK (cantidad > 0)
);
