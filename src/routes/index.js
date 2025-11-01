import { Router } from "express";
import { obtenerCategorias, obtenerCategoriasPorUsuario, crearCategoria, actualizarCategoriasUsuario } from "../services/categoria.service.js";
import { findUsuarioPorTelegramId } from "../services/usuario.service.js";
import { ROLES } from "../dictionaries/index.js";

const router = Router();

const isAdmin = async (req, res, next) => {
  const adminId = req.header("X-Admin-ID");
  if (!adminId) {
    return res.status(401).json({ status: "error", message: "No autorizado" });
  }
  const adminUser = await findUsuarioPorTelegramId(adminId);
  if (adminUser?.rol !== ROLES.ADMIN) {
    return res.status(403).json({ status: "error", message: "Permiso denegado" });
  }
  next();
};

router.get("/categorias", async (req, res) => {
  try {
    const categorias = await obtenerCategorias();
    res.status(200).json({ status: "success", data: { categorias } });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Error al obtener categorías" });
  }
});

router.post("/categorias", isAdmin, async (req, res) => {
  try {
    const nuevaCategoria = await crearCategoria(req.body);
    res.status(201).json({ status: "success", data: { categoria: nuevaCategoria } });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
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

router.post("/usuario/:telegramId/categorias", async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { selectedIds } = req.body;
    await actualizarCategoriasUsuario(telegramId, selectedIds);
    res.status(200).json({ status: "success", message: "Preferencias actualizadas" });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Error al actualizar las preferencias" });
  }
});

export default router;
