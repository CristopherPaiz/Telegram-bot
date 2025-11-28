import turso from "../src/config/turso.js";
import "dotenv/config";

const runMigration = async () => {
  console.log("Iniciando migración de tabla Ofertas...");

  try {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS Ofertas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fuente_id INTEGER NOT NULL,
        titulo TEXT NOT NULL,
        descripcion TEXT,
        precio_normal REAL,
        precio_oferta REAL NOT NULL,
        porcentaje_descuento INTEGER,
        imagen TEXT,
        enlace TEXT NOT NULL UNIQUE,
        categoria TEXT,
        fecha_captura DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (fuente_id) REFERENCES Fuentes(id)
      );
    `);
    console.log("Tabla Ofertas creada (si no existía).");

    // Índice para búsquedas rápidas por fuente y fecha
    await turso.execute(`
      CREATE INDEX IF NOT EXISTS idx_ofertas_fuente_fecha
      ON Ofertas(fuente_id, fecha_captura);
    `);
    console.log("Índice idx_ofertas_fuente_fecha creado.");
  } catch (error) {
    console.error("Error durante la migración:", error);
  }
};

runMigration();
