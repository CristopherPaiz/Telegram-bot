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

export const crearCategoria = async ({ nombre, emoji, padre_id }) => {
  try {
    const resultado = await turso.execute({
      sql: "INSERT INTO Categorias (nombre, emoji, padre_id) VALUES (?, ?, ?) RETURNING *;",
      args: [nombre, emoji || null, padre_id || null],
    });
    return resultado.rows[0];
  } catch (error) {
    console.error("Error al crear la categoría:", error);
    if (error.message.includes("UNIQUE constraint failed")) {
      throw new Error("Ya existe una categoría con ese nombre.");
    }
    throw new Error("No se pudo crear la categoría.");
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

export const actualizarCategoriasUsuario = async (telegramId, selectedIds) => {
  const tx = await turso.transaction();
  try {
    await tx.execute({
      sql: "DELETE FROM PreferenciasUsuarioCategoria WHERE usuario_telegram_id = ?;",
      args: [telegramId],
    });

    if (selectedIds && selectedIds.length > 0) {
      const stmts = selectedIds.map((id) => ({
        sql: "INSERT INTO PreferenciasUsuarioCategoria (usuario_telegram_id, categoria_id) VALUES (?, ?);",
        args: [telegramId, id],
      }));
      await tx.batch(stmts);
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    console.error("Error al actualizar categorías de usuario:", error);
    throw new Error("No se pudieron actualizar las preferencias de categorías.");
  }
};
