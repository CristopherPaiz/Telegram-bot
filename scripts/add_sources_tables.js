import turso from "../src/config/turso.js";
import "dotenv/config";

const runMigration = async () => {
  try {
    console.log("Iniciando migración de fuentes...");

    // Create Fuentes table
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS Fuentes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        url TEXT NOT NULL,
        metodo TEXT DEFAULT 'GET',
        tipo_respuesta TEXT DEFAULT 'JSON',
        headers TEXT,
        body_config TEXT,
        mapeo_campos TEXT
      );
    `);
    console.log("Tabla Fuentes creada/verificada.");

    // Create UsuarioFuentes table
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS UsuarioFuentes (
        usuario_id INTEGER,
        fuente_id INTEGER,
        PRIMARY KEY (usuario_id, fuente_id),
        FOREIGN KEY (usuario_id) REFERENCES Usuarios(telegram_id),
        FOREIGN KEY (fuente_id) REFERENCES Fuentes(id)
      );
    `);
    console.log("Tabla UsuarioFuentes creada/verificada.");

    // Seed GuatemalaDigital
    const guatemalaDigital = {
      nombre: "GuatemalaDigital",
      url: "https://guatemaladigital.com:85/api/Ofertas",
      metodo: "GET",
      tipo_respuesta: "JSON",
      headers: JSON.stringify({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      }),
      mapeo_campos: JSON.stringify({
        lista: "Response.Articulos",
        id: "CodigoProducto",
        titulo: "Nombre",
        descripcion: "Descripcion",
        precio_oferta: "PrecioOferta",
        precio_normal: "PrecioNormal",
        imagen: "UrlImagen",
        categoria: "Categoria",
        link_base: "https://guatemaladigital.com/Producto/", // Asumimos que el link se construye así + ID
      }),
    };

    const existing = await turso.execute({
      sql: "SELECT id FROM Fuentes WHERE nombre = ?",
      args: [guatemalaDigital.nombre],
    });

    if (existing.rows.length === 0) {
      await turso.execute({
        sql: `INSERT INTO Fuentes (nombre, url, metodo, tipo_respuesta, headers, mapeo_campos) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          guatemalaDigital.nombre,
          guatemalaDigital.url,
          guatemalaDigital.metodo,
          guatemalaDigital.tipo_respuesta,
          guatemalaDigital.headers,
          guatemalaDigital.mapeo_campos,
        ],
      });
      console.log("Fuente GuatemalaDigital insertada.");
    } else {
      console.log("Fuente GuatemalaDigital ya existe.");
    }

    console.log("Migración de fuentes completada.");
  } catch (error) {
    console.error("Error en la migración de fuentes:", error);
  }
};

runMigration();
