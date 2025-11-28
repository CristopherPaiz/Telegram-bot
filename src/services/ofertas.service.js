import { obtenerFuentesPorUsuario, asignarFuentesPorDefecto } from "./fuentes.service.js";
import { ejecutarScraping } from "./scraper.service.js";
import { obtenerPreferencias } from "./preferencias.service.js";
import { obtenerCategoriasPorUsuario } from "./categoria.service.js";

export const cargarOfertas = async (telegramId) => {
  try {
    // 1. Obtener preferencias del usuario
    const preferencias = await obtenerPreferencias(telegramId);
    if (!preferencias) throw new Error("Usuario sin preferencias configuradas.");

    // 2. Obtener categorías seleccionadas (Set de IDs)
    const categoriasIds = await obtenerCategoriasPorUsuario(telegramId);

    // 3. Obtener fuentes del usuario
    let fuentes = await obtenerFuentesPorUsuario(telegramId);

    // Si no tiene fuentes asignadas, asignamos las por defecto (auto-healing)
    if (fuentes.length === 0) {
      await asignarFuentesPorDefecto(telegramId);
      fuentes = await obtenerFuentesPorUsuario(telegramId);
    }

    console.log(`[OFERTAS] Buscando ofertas para usuario ${telegramId} en ${fuentes.length} fuentes...`);

    let todasLasOfertas = [];

    // 4. Ejecutar scraping en paralelo para cada fuente
    const promesasScraping = fuentes.map((f) => ejecutarScraping(f));
    const resultados = await Promise.all(promesasScraping);

    // Aplanar resultados
    resultados.forEach((ofertasFuente) => {
      todasLasOfertas = [...todasLasOfertas, ...ofertasFuente];
    });

    console.log(`[OFERTAS] Total ofertas encontradas (sin filtrar): ${todasLasOfertas.length}`);

    // 5. Filtrar ofertas según preferencias
    const ofertasFiltradas = todasLasOfertas.filter((oferta) => {
      // Filtro por precio
      if (oferta.precio_oferta < preferencias.precio_min) return false;
      if (preferencias.precio_max > 0 && oferta.precio_oferta > preferencias.precio_max) return false;

      // Filtro por porcentaje de descuento
      if (oferta.porcentaje < preferencias.porcentaje_descuento_min) return false;

      // Filtro por categoría (básico por string matching ya que el scraping no trae IDs de categoría)
      // Aquí podríamos mejorar la lógica con un clasificador de texto o mapeo más estricto
      // Por ahora, si el usuario seleccionó categorías, intentamos buscar coincidencias en el título o categoría del item
      // NOTA: Esto es una simplificación. Idealmente el scraper debería normalizar categorías.

      return true;
    });

    console.log(`[OFERTAS] Total ofertas filtradas: ${ofertasFiltradas.length}`);
    return ofertasFiltradas;
  } catch (error) {
    console.error("Error en cargarOfertas:", error);
    return [];
  }
};
