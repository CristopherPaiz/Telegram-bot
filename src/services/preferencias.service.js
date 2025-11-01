import turso from "../config/turso.js";

export const crearPreferenciasDefault = async (telegramId) => {
  try {
    await turso.execute({
      sql: "INSERT OR IGNORE INTO PreferenciasUsuario (usuario_telegram_id) VALUES (?);",
      args: [telegramId],
    });
  } catch (error) {
    console.error("Error al crear preferencias default para el usuario:", error);
    throw new Error("No se pudieron crear las preferencias del usuario.");
  }
};

export const obtenerPreferencias = async (telegramId) => {
  try {
    const resultado = await turso.execute({
      sql: "SELECT * FROM PreferenciasUsuario WHERE usuario_telegram_id = ?",
      args: [telegramId],
    });
    return resultado.rows.length > 0 ? resultado.rows[0] : null;
  } catch (error) {
    console.error("Error al obtener las preferencias del usuario:", error);
    throw new Error("No se pudieron obtener las preferencias del usuario.");
  }
};

export const actualizarPreferencias = async (telegramId, nuevasPreferencias) => {
  const campos = Object.keys(nuevasPreferencias);
  const valores = Object.values(nuevasPreferencias);
  const setClause = campos.map((campo) => `${campo} = ?`).join(", ");

  if (campos.length === 0) return;

  try {
    await turso.execute({
      sql: `UPDATE PreferenciasUsuario SET ${setClause} WHERE usuario_telegram_id = ?;`,
      args: [...valores, telegramId],
    });
  } catch (error) {
    console.error("Error al actualizar las preferencias del usuario:", error);
    throw new Error("No se pudieron actualizar las preferencias del usuario.");
  }
};
