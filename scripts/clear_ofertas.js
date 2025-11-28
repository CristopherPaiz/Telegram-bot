import turso from "../src/config/turso.js";
import "dotenv/config";

const clearOfertas = async () => {
  try {
    await turso.execute("DELETE FROM Ofertas");
    console.log("Tabla Ofertas limpiada.");
  } catch (error) {
    console.error(error);
  }
};

clearOfertas();
