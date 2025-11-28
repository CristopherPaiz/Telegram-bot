import turso from "../config/turso.js";

export const obtenerFuentes = async () => {
  try {
    const resultado = await turso.execute("SELECT * FROM Fuentes");
    return resultado.rows;
  } catch (error) {
    console.error("Error al obtener fuentes:", error);
    return [];
  }
};

export const obtenerFuentesPorUsuario = async (usuarioId) => {
  try {
    const resultado = await turso.execute({
      sql: `
        SELECT f.*
        FROM Fuentes f
        JOIN UsuarioFuentes uf ON f.id = uf.fuente_id
        WHERE uf.usuario_id = ?
      `,
      args: [usuarioId],
    });
    return resultado.rows;
  } catch (error) {
    console.error("Error al obtener fuentes del usuario:", error);
    return [];
  }
};

export const actualizarFuentesUsuario = async (usuarioId, fuenteIds) => {
  try {
    // Primero borramos las existentes
    await turso.execute({
      sql: "DELETE FROM UsuarioFuentes WHERE usuario_id = ?",
      args: [usuarioId],
    });

    // Insertamos las nuevas
    if (fuenteIds && fuenteIds.length > 0) {
      const placeholders = fuenteIds.map(() => "(?, ?)").join(", ");
      const args = fuenteIds.flatMap((fid) => [usuarioId, fid]);

      await turso.execute({
        sql: `INSERT INTO UsuarioFuentes (usuario_id, fuente_id) VALUES ${placeholders}`,
        args: args,
      });
    }
  } catch (error) {
    console.error("Error al actualizar fuentes del usuario:", error);
    throw error;
  }
};

// Inicializar fuentes por defecto para un usuario nuevo (opcional)
export const asignarFuentesPorDefecto = async (usuarioId) => {
  try {
    const fuentes = await obtenerFuentes();
    if (fuentes.length > 0) {
      // Por defecto asignamos todas o solo algunas, aquí asignamos todas
      const ids = fuentes.map((f) => f.id);
      await actualizarFuentesUsuario(usuarioId, ids);
    }
  } catch (error) {
    console.error("Error al asignar fuentes por defecto:", error);
  }
};
