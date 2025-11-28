import "dotenv/config";
import app from "./app.js";
import { iniciarTelegram } from "./services/bot.service.js";

const PORT = process.env.API_PORT || 3002;

app.listen(PORT, () => {
  console.log(`Servidor Express escuchando en el puerto ${PORT}`);

  // Iniciar Telegram con retraso para evitar conflictos de despliegue
  iniciarTelegram(10000); // 10 segundos de espera
});
