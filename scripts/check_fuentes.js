import turso from "../src/config/turso.js";
import "dotenv/config";

const checkFuentes = async () => {
  try {
    const result = await turso.execute("SELECT * FROM Fuentes WHERE nombre = 'GuatemalaDigital'");
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error(error);
  }
};

checkFuentes();
