-- Migración: tabla usuario para PostgreSQL / Supabase

CREATE TABLE IF NOT EXISTS usuario (
  id_user     SERIAL PRIMARY KEY,
  name_user   VARCHAR(50)  NOT NULL UNIQUE,
  nombre      VARCHAR(100) NOT NULL,
  apellido    VARCHAR(100) NOT NULL,
  correo_electronico VARCHAR(150) NOT NULL UNIQUE,
  contrasena  VARCHAR(255) NOT NULL,
  rol         VARCHAR(20)  NOT NULL DEFAULT 'mozo'
                CHECK (rol IN ('admin', 'mozo', 'cajero', 'buffet')),
  estado      VARCHAR(20)  NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente', 'activo', 'inactivo')),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_usuario_correo  ON usuario (correo_electronico);
CREATE INDEX IF NOT EXISTS idx_usuario_estado  ON usuario (estado);
CREATE INDEX IF NOT EXISTS idx_usuario_rol     ON usuario (rol);

-- Usuario administrador de prueba
-- OJO: el hash de abajo corresponde a la contraseña "password" (cambiala en producción)
INSERT INTO usuario (name_user, nombre, apellido, correo_electronico, contrasena, rol, estado)
VALUES (
  'admin',
  'Administrador',
  'Sistema',
  'admin@evento.com',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'admin',
  'activo'
)
ON CONFLICT (name_user) DO NOTHING;
