import fetch from "node-fetch";

export const ejecutarScraping = async (fuente) => {
  try {
    console.log(`[SCRAPER] Iniciando scraping de: ${fuente.nombre}`);

    const options = {
      method: fuente.metodo || "GET",
      headers: fuente.headers ? JSON.parse(fuente.headers) : {},
    };

    if (fuente.metodo === "POST" && fuente.body_config) {
      options.body = fuente.body_config; // Aquí podríamos inyectar variables dinámicas si fuera necesario
    }

    const response = await fetch(fuente.url, options);

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    if (fuente.tipo_respuesta === "JSON") {
      const data = await response.json();
      return procesarRespuestaJson(data, JSON.parse(fuente.mapeo_campos));
    } else {
      // TODO: Implementar HTML parsing con cheerio/jsdom
      console.warn(`[SCRAPER] Tipo de respuesta ${fuente.tipo_respuesta} no soportado aún.`);
      return [];
    }
  } catch (error) {
    console.error(`[SCRAPER] Error al scrapear ${fuente.nombre}:`, error);
    return [];
  }
};

const procesarRespuestaJson = (data, mapeo) => {
  try {
    // Navegar hasta la lista de items usando "lista": "Response.Articulos"
    const rutaLista = mapeo.lista.split(".");
    let items = data;
    for (const key of rutaLista) {
      if (items[key]) {
        items = items[key];
      } else {
        return [];
      }
    }

    if (!Array.isArray(items)) return [];

    return items.map((item) => {
      // Extraer campos básicos
      const oferta = {
        id: obtenerValor(item, mapeo.id),
        titulo: obtenerValor(item, mapeo.titulo),
        descripcion: obtenerValor(item, mapeo.descripcion),
        precio_oferta: parseFloat(obtenerValor(item, mapeo.precio_oferta)),
        precio_normal: parseFloat(obtenerValor(item, mapeo.precio_normal)),
        imagen: obtenerValor(item, mapeo.imagen),
        categoria: obtenerValor(item, mapeo.categoria),
        enlace: mapeo.link_base ? `${mapeo.link_base}${obtenerValor(item, mapeo.id)}` : "#",
      };

      // Calcular porcentaje si no viene
      if (!oferta.porcentaje && oferta.precio_normal > 0) {
        oferta.porcentaje = Math.round(((oferta.precio_normal - oferta.precio_oferta) / oferta.precio_normal) * 100);
      }

      return oferta;
    });
  } catch (error) {
    console.error("[SCRAPER] Error procesando JSON:", error);
    return [];
  }
};

const obtenerValor = (obj, ruta) => {
  if (!ruta) return null;
  const keys = ruta.split(".");
  let val = obj;
  for (const key of keys) {
    if (val && val[key] !== undefined) {
      val = val[key];
    } else {
      return null;
    }
  }
  return val;
};
