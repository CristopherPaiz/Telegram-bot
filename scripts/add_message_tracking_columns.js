import turso from "../src/config/turso.js";
import "dotenv/config";

const runMigration = async () => {
  try {
    console.log("Iniciando migración...");

    // Add config_message_id column
    try {
      await turso.execute(`ALTER TABLE Usuarios ADD COLUMN config_message_id INTEGER;`);
      console.log("Columna config_message_id agregada.");
    } catch (e) {
      if (e.message.includes("duplicate column name")) {
        console.log("La columna config_message_id ya existe.");
      } else {
        console.error("Error al agregar config_message_id:", e);
      }
    }

    // Add last_summary_message_id column
    try {
      await turso.execute(`ALTER TABLE Usuarios ADD COLUMN last_summary_message_id INTEGER;`);
      console.log("Columna last_summary_message_id agregada.");
    } catch (e) {
      if (e.message.includes("duplicate column name")) {
        console.log("La columna last_summary_message_id ya existe.");
      } else {
        console.error("Error al agregar last_summary_message_id:", e);
      }
    }

    console.log("Migración completada.");
  } catch (error) {
    console.error("Error general en la migración:", error);
  }
};

runMigration();
