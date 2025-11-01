import { Router } from "express";
import { obtenerCategorias, obtenerCategoriasPorUsuario } from "../services/categoria.service.js";

const router = Router();

router.get("/categorias", async (req, res) => {
  try {
    const categorias = await obtenerCategorias();
    res.status(200).json({ status: "success", data: { categorias } });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Error al obtener categorías" });
  }
});

router.get("/usuario/:telegramId/categorias", async (req, res) => {
  try {
    const { telegramId } = req.params;
    const categoriasIds = await obtenerCategoriasPorUsuario(telegramId);
    res.status(200).json({ status: "success", data: { selectedIds: Array.from(categoriasIds) } });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Error al obtener las categorías del usuario" });
  }
});

export default router;
