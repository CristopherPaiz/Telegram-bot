import turso from "../config/turso.js";
import { ROLES } from "../dictionaries/index.js";
import { crearPreferenciasDefault } from "./preferencias.service.js";

export const registrarOActualizarUsuario = async (usuarioTelegram) => {
  try {
    await turso.execute({
      sql: `
        INSERT INTO Usuarios (telegram_id, nombre, username, is_bot, rol)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(telegram_id) DO UPDATE SET
          nombre = excluded.nombre,
          username = excluded.username,
          is_bot = excluded.is_bot;
      `,
      args: [usuarioTelegram.id, usuarioTelegram.first_name, usuarioTelegram.username || null, usuarioTelegram.is_bot, ROLES.USUARIO],
    });

    await crearPreferenciasDefault(usuarioTelegram.id);
  } catch (error) {
    console.error("Error al registrar o actualizar el usuario:", error);
    throw new Error("No se pudo registrar al usuario en la base de datos.");
  }
};

export const findUsuarioPorTelegramId = async (telegramId) => {
  try {
    const resultado = await turso.execute({
      sql: "SELECT * FROM Usuarios WHERE telegram_id = ?",
      args: [telegramId],
    });
    return resultado.rows.length > 0 ? resultado.rows[0] : null;
  } catch (error) {
    console.error("Error al buscar usuario por ID de Telegram:", error);
    throw new Error("Error al consultar la base de datos.");
  }
};

export const marcarConfiguracionCompleta = async (telegramId) => {
  try {
    await turso.execute({
      sql: "UPDATE Usuarios SET configuracion_inicial_completa = 1 WHERE telegram_id = ?;",
      args: [telegramId],
    });
  } catch (error) {
    console.error("Error al marcar la configuración como completa:", error);
    throw new Error("No se pudo actualizar el estado del usuario.");
  }
};

export const actualizarNombreUsuario = async (telegramId, nombre) => {
  try {
    await turso.execute({
      sql: "UPDATE Usuarios SET nombre = ? WHERE telegram_id = ?;",
      args: [nombre, telegramId],
    });
  } catch (error) {
    console.error("Error al actualizar el nombre del usuario:", error);
    throw new Error("No se pudo actualizar el nombre del usuario.");
  }
};

export const actualizarConfigMessageId = async (telegramId, messageId) => {
  try {
    await turso.execute({
      sql: "UPDATE Usuarios SET config_message_id = ? WHERE telegram_id = ?;",
      args: [messageId, telegramId],
    });
  } catch (error) {
    console.error("Error al actualizar config_message_id:", error);
  }
};

export const obtenerConfigMessageId = async (telegramId) => {
  try {
    const resultado = await turso.execute({
      sql: "SELECT config_message_id FROM Usuarios WHERE telegram_id = ?",
      args: [telegramId],
    });
    return resultado.rows.length > 0 ? resultado.rows[0].config_message_id : null;
  } catch (error) {
    console.error("Error al obtener config_message_id:", error);
    return null;
  }
};

export const actualizarLastSummaryMessageId = async (telegramId, messageId) => {
  try {
    await turso.execute({
      sql: "UPDATE Usuarios SET last_summary_message_id = ? WHERE telegram_id = ?;",
      args: [messageId, telegramId],
    });
  } catch (error) {
    console.error("Error al actualizar last_summary_message_id:", error);
  }
};

export const obtenerLastSummaryMessageId = async (telegramId) => {
  try {
    const resultado = await turso.execute({
      sql: "SELECT last_summary_message_id FROM Usuarios WHERE telegram_id = ?",
      args: [telegramId],
    });
    return resultado.rows.length > 0 ? resultado.rows[0].last_summary_message_id : null;
  } catch (error) {
    console.error("Error al obtener last_summary_message_id:", error);
    return null;
  }
};
