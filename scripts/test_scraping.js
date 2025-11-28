import { cargarOfertas } from "../src/services/ofertas.service.js";
import "dotenv/config";

const test = async () => {
  console.log("Iniciando prueba de scraping para usuario 815189312...");
  try {
    const ofertas = await cargarOfertas(815189312);

    if (ofertas.length > 0) {
      console.log("Ejemplo de enlaces:");
      ofertas.slice(0, 5).forEach((o) => console.log(`- ${o.titulo}: ${o.enlace}`));
    }

    console.log(`Resultado final: ${ofertas.length} ofertas.`);
  } catch (error) {
    console.error("Error en prueba:", error);
  }
};

test();
