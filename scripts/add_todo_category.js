import turso from "../src/config/turso.js";
import "dotenv/config";

const runMigration = async () => {
  try {
    console.log("Iniciando migración de categoría TODO...");

    const todoCategory = {
      nombre: "TODO",
      emoji: "♾️",
      padre_id: null,
    };

    const existing = await turso.execute({
      sql: "SELECT id FROM Categorias WHERE nombre = ?",
      args: [todoCategory.nombre],
    });

    if (existing.rows.length === 0) {
      await turso.execute({
        sql: `INSERT INTO Categorias (nombre, emoji, padre_id) VALUES (?, ?, ?)`,
        args: [todoCategory.nombre, todoCategory.emoji, todoCategory.padre_id],
      });
      console.log("Categoría TODO insertada.");
    } else {
      console.log("Categoría TODO ya existe.");
    }

    console.log("Migración completada.");
  } catch (error) {
    console.error("Error en la migración:", error);
  }
};

runMigration();
