import { Router } from "express";
import { obtenerCategorias, obtenerCategoriasPorUsuario, actualizarCategoriasUsuario } from "../services/categoria.service.js";
import { findUsuarioPorTelegramId, marcarConfiguracionCompleta, actualizarNombreUsuario } from "../services/usuario.service.js";
import { ROLES } from "../dictionaries/index.js";
import { obtenerPreferencias, actualizarPreferencias } from "../services/preferencias.service.js";
import { guardarConfiguracion } from "../controllers/configuracion.controller.js";

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

router.post("/usuario/:telegramId/configuracion", guardarConfiguracion);

// --- RUTAS DE FUENTES ---

// Obtener todas las fuentes disponibles
router.get("/fuentes", async (req, res) => {
  try {
    const { obtenerFuentes } = await import("../services/fuentes.service.js");
    const fuentes = await obtenerFuentes();
    res.json({ status: "success", data: fuentes });
  } catch (error) {
    console.error("Error al obtener fuentes:", error);
    res.status(500).json({ status: "error", message: "Error interno" });
  }
});

// Obtener fuentes seleccionadas por un usuario
router.get("/usuario/:telegramId/fuentes", async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { obtenerFuentesPorUsuario } = await import("../services/fuentes.service.js");
    const fuentes = await obtenerFuentesPorUsuario(telegramId);
    res.json({ status: "success", data: fuentes });
  } catch (error) {
    console.error("Error al obtener fuentes del usuario:", error);
    res.status(500).json({ status: "error", message: "Error interno" });
  }
});

// Actualizar fuentes seleccionadas por un usuario
router.post("/usuario/:telegramId/fuentes", async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { fuentesIds } = req.body; // Array de IDs [1, 2, ...]
    const { actualizarFuentesUsuario } = await import("../services/fuentes.service.js");

    await actualizarFuentesUsuario(telegramId, fuentesIds);
    res.json({ status: "success", message: "Fuentes actualizadas correctamente" });
  } catch (error) {
    console.error("Error al actualizar fuentes del usuario:", error);
    res.status(500).json({ status: "error", message: "Error interno" });
  }
});

export default router;
