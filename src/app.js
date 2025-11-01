import express from "express";
import { initializeBot } from "./services/bot.service.js";
import apiRoutes from "./routes/index.js";

const app = express();

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use("/api", apiRoutes);

initializeBot();

app.get("/", (req, res) => {
  res.send("El bot de ofertas está funcionando correctamente.");
});

export default app;
