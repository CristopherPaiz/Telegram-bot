import "dotenv/config";
import app from "./app.js";
import { initializeBot } from "./services/bot.service.js";

const PORT = process.env.API_PORT || 3002;

app.listen(PORT, () => {
  console.log(`Servidor Express escuchando en el puerto ${PORT}`);
});

const bot = initializeBot();

const gracefulShutdown = () => {
  console.log("Deteniendo el bot de Telegram...");
  bot.stopPolling().then(() => {
    console.log("Bot detenido. Saliendo.");
    process.exit(0);
  });
};

// Capturar señales de terminación para detener el bot limpiamente
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
