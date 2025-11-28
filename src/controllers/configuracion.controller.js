import { actualizarNombreUsuario, marcarConfiguracionCompleta } from "../services/usuario.service.js";
import { actualizarPreferencias } from "../services/preferencias.service.js";
import { actualizarCategoriasUsuario } from "../services/categoria.service.js";
import { procesarFinalizacionConfiguracion } from "../services/bot.service.js";

export const guardarConfiguracion = async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { nombre, porcentajeDescuento, precioMin, precioMax, selectedIds } = req.body;

    console.log(`[API CONFIG] Recibida configuración para TelegramID: ${telegramId}`);
    console.log(`[API CONFIG] Datos:`, JSON.stringify(req.body));

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

    console.log(`[API CONFIG] Datos guardados en BD. Triggering bot actions...`);

    // Trigger bot cleanup and summary
    // No esperamos a que termine para responder rápido a la UI
    procesarFinalizacionConfiguracion(telegramId).catch((err) => {
      console.error("[API CONFIG ERROR] Error al procesar finalización del bot:", err);
    });

    res.status(200).json({ status: "success", message: "Configuración actualizada correctamente" });
  } catch (error) {
    console.error("[API CONFIG ERROR] Error general:", error);
    res.status(500).json({ status: "error", message: "Error al actualizar la configuración" });
  }
};
