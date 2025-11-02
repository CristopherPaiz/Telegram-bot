import { Router } from "express";
import { obtenerCategorias, obtenerCategoriasPorUsuario, actualizarCategoriasUsuario } from "../services/categoria.service.js";
import { findUsuarioPorTelegramId, marcarConfiguracionCompleta, actualizarNombreUsuario } from "../services/usuario.service.js";
import { ROLES } from "../dictionaries/index.js";
import { obtenerPreferencias, actualizarPreferencias } from "../services/preferencias.service.js";

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

router.get("/usuario/:telegramId/preferencias", async (req, res) => {
  try {
    const { telegramId } = req.params;
    const [usuario, preferencias, categoriasIds] = await Promise.all([
      findUsuarioPorTelegramId(telegramId),
      obtenerPreferencias(telegramId),
      obtenerCategoriasPorUsuario(telegramId),
    ]);

    res.status(200).json({
      status: "success",
      data: {
        nombre: usuario?.nombre || "",
        porcentajeDescuento: preferencias?.porcentaje_descuento_min || 50,
        precioMin: preferencias?.precio_min || 0,
        precioMax: preferencias?.precio_max || 10000,
        selectedIds: Array.from(categoriasIds),
      },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Error al obtener las preferencias del usuario" });
  }
});

router.post("/usuario/:telegramId/configuracion", async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { nombre, porcentajeDescuento, precioMin, precioMax, selectedIds } = req.body;

    const preferencias = {
      porcentaje_descuento_min: porcentajeDescuento,
      precio_min: precioMin,
      precio_max: precioMax,
    };

    await Promise.all([
      actualizarNombreUsuario(telegramId, nombre),
      actualizarPreferencias(telegramId, preferencias),
      actualizarCategoriasUsuario(telegramId, selectedIds),
      marcarConfiguracionCompleta(telegramId),
    ]);

    res.status(200).json({ status: "success", message: "Configuración actualizada correctamente" });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Error al actualizar la configuración" });
  }
});

export default router;
