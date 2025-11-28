import turso from "../src/config/turso.js";
import "dotenv/config";

const checkSchema = async () => {
  try {
    const result = await turso.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='PreferenciasUsuario'");
    console.log("Schema:", result.rows[0]?.sql);

    const indices = await turso.execute("SELECT * FROM sqlite_master WHERE type='index' AND tbl_name='PreferenciasUsuario'");
    console.log("Indices:", indices.rows);
  } catch (error) {
    console.error(error);
  }
};

checkSchema();
