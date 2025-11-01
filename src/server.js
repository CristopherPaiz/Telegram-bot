import "dotenv/config";
import app from "./app.js";

const PORT = process.env.API_PORT || 3002;

app.listen(PORT, () => {
  console.log(`Servidor del Bot escuchando en el puerto ${PORT}`);
});
