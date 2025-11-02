import "dotenv/config";
import app from "./app.js";
import { initializeBot } from "./services/bot.service.js";

const PORT = process.env.API_PORT || 3002;

app.listen(PORT, () => {
  console.log(`Servidor Express escuchando en el puerto ${PORT}`);
});

initializeBot();
