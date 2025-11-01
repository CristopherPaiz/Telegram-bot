import turso from "../config/turso.js";

export const obtenerCategorias = async () => {
  try {
    const resultado = await turso.execute("SELECT * FROM Categorias ORDER BY nombre;");
    return resultado.rows;
  } catch (error) {
    console.error("Error al obtener categorías:", error);
    throw new Error("No se pudieron obtener las categorías.");
  }
};

export const obtenerCategoriasPorUsuario = async (telegramId) => {
  try {
    const resultado = await turso.execute({
      sql: "SELECT categoria_id FROM PreferenciasUsuarioCategoria WHERE usuario_telegram_id = ?;",
      args: [telegramId],
    });
    return new Set(resultado.rows.map((row) => row.categoria_id));
  } catch (error) {
    console.error("Error al obtener las categorías del usuario:", error);
    throw new Error("No se pudieron obtener las preferencias de categorías.");
  }
};

export const togglePreferenciaCategoria = async (telegramId, categoriaId) => {
  try {
    const existe = await turso.execute({
      sql: "SELECT 1 FROM PreferenciasUsuarioCategoria WHERE usuario_telegram_id = ? AND categoria_id = ?;",
      args: [telegramId, categoriaId],
    });

    if (existe.rows.length > 0) {
      await turso.execute({
        sql: "DELETE FROM PreferenciasUsuarioCategoria WHERE usuario_telegram_id = ? AND categoria_id = ?;",
        args: [telegramId, categoriaId],
      });
      return "eliminada";
    } else {
      await turso.execute({
        sql: "INSERT INTO PreferenciasUsuarioCategoria (usuario_telegram_id, categoria_id) VALUES (?, ?);",
        args: [telegramId, categoriaId],
      });
      return "agregada";
    }
  } catch (error) {
    console.error("Error al alternar la preferencia de categoría:", error);
    throw new Error("No se pudo actualizar la preferencia de categoría.");
  }
};
