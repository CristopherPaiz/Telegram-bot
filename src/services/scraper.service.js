import turso from "../config/turso.js";
import fetch from "node-fetch";

const guardarOfertasEnBD = async (ofertas, fuenteId) => {
  if (!ofertas || ofertas.length === 0) return;

  console.log(`[SCRAPER] Guardando ${ofertas.length} ofertas en BD para fuente ${fuenteId}...`);

  try {
    const placeholders = ofertas.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)").join(", ");
    const args = ofertas.flatMap((o) => [
      fuenteId,
      o.titulo,
      o.descripcion || null,
      o.precio_normal || null,
      o.precio_oferta,
      o.porcentaje,
      o.imagen || null,
      o.enlace,
      o.categoria || null,
    ]);

    // Usamos ON CONFLICT para actualizar la fecha de captura y precio si ya existe
    await turso.execute({
      sql: `
        INSERT INTO Ofertas (fuente_id, titulo, descripcion, precio_normal, precio_oferta, porcentaje_descuento, imagen, enlace, categoria, fecha_captura)
        VALUES ${placeholders}
        ON CONFLICT(enlace) DO UPDATE SET
          precio_oferta = excluded.precio_oferta,
          porcentaje_descuento = excluded.porcentaje_descuento,
          fecha_captura = CURRENT_TIMESTAMP;
      `,
      args,
    });
    console.log(`[SCRAPER] Ofertas guardadas/actualizadas en BD.`);
  } catch (error) {
    console.error(`[SCRAPER ERROR] Fallo al guardar ofertas en BD:`, error);
  }
};

export const ejecutarScraping = async (fuente) => {
  console.log(`[SCRAPER] Iniciando scraping de: ${fuente.nombre}`);
  try {
    let data;

    // 1. Obtener datos según el método
    if (fuente.metodo === "GET") {
      const response = await fetch(fuente.url, {
        headers: fuente.headers ? JSON.parse(fuente.headers) : {},
      });
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      data = await response.json(); // Asumimos JSON por ahora
    } else if (fuente.metodo === "POST") {
      const response = await fetch(fuente.url, {
        method: "POST",
        headers: fuente.headers ? JSON.parse(fuente.headers) : {},
        body: fuente.body_config,
      });
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      data = await response.json();
    }

    // 2. Mapear campos
    const mapeo = JSON.parse(fuente.mapeo_campos);
    let items = data;

    // Navegar hasta el array de items si es necesario (ej: data.results)
    const rootPath = mapeo.root_path || mapeo.lista; // Compatibilidad con ambos nombres
    if (rootPath) {
      const parts = rootPath.split(".");
      for (const part of parts) {
        items = items[part];
      }
    }

    if (!Array.isArray(items)) {
      console.warn(`[SCRAPER] La respuesta de ${fuente.nombre} no es un array en la ruta especificada.`);
      return [];
    }

    const ofertas = items.map((item) => {
      // Helper para obtener valor anidado
      const getValue = (obj, path) => {
        if (!path) return null;
        return path.split(".").reduce((o, p) => (o ? o[p] : null), obj);
      };

      const precioNormal = parseFloat(getValue(item, mapeo.precio_normal));
      const precioOferta = parseFloat(getValue(item, mapeo.precio_oferta));

      // Calcular porcentaje si no viene explícito
      let porcentaje = 0;
      if (mapeo.porcentaje_descuento) {
        porcentaje = parseInt(getValue(item, mapeo.porcentaje_descuento));
      } else if (precioNormal && precioOferta) {
        porcentaje = Math.round(((precioNormal - precioOferta) / precioNormal) * 100);
      }

      return {
        id: getValue(item, mapeo.id), // ID externo
        titulo: getValue(item, mapeo.titulo),
        descripcion: getValue(item, mapeo.descripcion),
        precio_normal: precioNormal,
        precio_oferta: precioOferta,
        imagen: getValue(item, mapeo.imagen),
        categoria: getValue(item, mapeo.categoria),
        enlace: getValue(item, mapeo.enlace) || fuente.url, // Fallback a URL base si no hay enlace específico
        porcentaje: porcentaje,
      };
    });

    // 3. Guardar en BD (Side effect)
    await guardarOfertasEnBD(ofertas, fuente.id);

    return ofertas;
  } catch (error) {
    console.error(`[SCRAPER ERROR] ${fuente.nombre}:`, error.message);
    return [];
  }
};
