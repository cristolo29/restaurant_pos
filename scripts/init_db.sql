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
    pin           VARCHAR(6),
    activo        BOOLEAN NOT NULL DEFAULT true
);

-- Usuario admin por defecto (PIN: 0000)
INSERT INTO orbezo.usuario (rol_id, nombre, email, password_hash, pin, activo)
SELECT r.id, 'Administrador', 'admin@orbezo.com', 'sin_password', '0000', true
FROM orbezo.rol r WHERE r.nombre = 'admin'
ON CONFLICT (email) DO NOTHING;

-- Salones
CREATE TABLE IF NOT EXISTS orbezo.salon (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(80) NOT NULL,
    descripcion VARCHAR,
    activo      BOOLEAN DEFAULT true
);

INSERT INTO orbezo.salon (nombre, activo) VALUES
    ('Salón principal', true),
    ('Terraza',         true)
ON CONFLICT DO NOTHING;

-- Mesas
CREATE TABLE IF NOT EXISTS orbezo.mesa (
    id        SERIAL PRIMARY KEY,
    salon_id  INTEGER,
    numero    VARCHAR(10),
    capacidad INTEGER DEFAULT 4,
    estado    VARCHAR(20) DEFAULT 'disponible'
);

-- Categorías
CREATE TABLE IF NOT EXISTS orbezo.categoria (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(80) NOT NULL,
    descripcion VARCHAR,
    activo      BOOLEAN NOT NULL DEFAULT true
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
    afecto_igv   BOOLEAN NOT NULL DEFAULT true
);

-- Series de comprobantes
CREATE TABLE IF NOT EXISTS orbezo.serie_comprobante (
    id          SERIAL PRIMARY KEY,
    tipo        VARCHAR(10) NOT NULL,
    serie       VARCHAR(4) NOT NULL,
    correlativo INTEGER NOT NULL DEFAULT 1,
    activo      BOOLEAN NOT NULL DEFAULT true
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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items de pedido
CREATE TABLE IF NOT EXISTS orbezo.pedido_item (
    id          SERIAL PRIMARY KEY,
    pedido_id   INTEGER NOT NULL REFERENCES orbezo.pedido(id),
    producto_id INTEGER NOT NULL REFERENCES orbezo.producto(id),
    cantidad    INTEGER NOT NULL DEFAULT 1,
    precio_unit NUMERIC(10,2) NOT NULL,
    subtotal    NUMERIC(10,2) NOT NULL,
    estado      VARCHAR(20) DEFAULT 'pendiente',
    nota        VARCHAR
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
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Items de comprobante
CREATE TABLE IF NOT EXISTS orbezo.comprobante_item (
    id             SERIAL PRIMARY KEY,
    comprobante_id INTEGER NOT NULL REFERENCES orbezo.comprobante(id),
    descripcion    VARCHAR(250) NOT NULL,
    cantidad       NUMERIC(10,3) NOT NULL,
    precio_unit    NUMERIC(10,4) NOT NULL,
    subtotal       NUMERIC(10,2) NOT NULL,
    igv_item       NUMERIC(10,2) NOT NULL DEFAULT 0
);
