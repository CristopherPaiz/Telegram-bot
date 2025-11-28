import { obtenerFuentesPorUsuario, asignarFuentesPorDefecto } from "./fuentes.service.js";
import { ejecutarScraping } from "./scraper.service.js";
import { obtenerPreferencias, crearPreferenciasDefault } from "./preferencias.service.js";
import { obtenerCategoriasPorUsuario, obtenerCategorias } from "./categoria.service.js";

import turso from "../config/turso.js";

// Función para obtener ofertas desde la BD (caché)
const obtenerOfertasDeBD = async (fuenteId) => {
  try {
    const resultado = await turso.execute({
      sql: `
        SELECT * FROM Ofertas
        WHERE fuente_id = ?
        AND fecha_captura > datetime('now', '-12 hours')
        ORDER BY porcentaje_descuento DESC
      `,
      args: [fuenteId],
    });
    return resultado.rows;
  } catch (error) {
    console.error(`[CACHE ERROR] Fallo al leer caché para fuente ${fuenteId}:`, error);
    return [];
  }
};

export const cargarOfertas = async (telegramId) => {
  try {
    // 1. Obtener preferencias del usuario
    let preferencias = await obtenerPreferencias(telegramId);

    if (!preferencias) {
      console.log(`[OFERTAS] Usuario ${telegramId} sin preferencias. Creando default...`);
      await crearPreferenciasDefault(telegramId);
      preferencias = await obtenerPreferencias(telegramId);
    }
    if (!preferencias) throw new Error("No se pudieron cargar las preferencias.");

    // 2. Obtener categorías y fuentes
    const categoriasIds = await obtenerCategoriasPorUsuario(telegramId);
    const todasCategorias = await obtenerCategorias();
    const todoCategory = todasCategorias.find((c) => c.nombre === "TODO");
    const isTodoSelected = todoCategory && categoriasIds.has(todoCategory.id);

    let fuentes = await obtenerFuentesPorUsuario(telegramId);
    if (fuentes.length === 0) {
      await asignarFuentesPorDefecto(telegramId);
      fuentes = await obtenerFuentesPorUsuario(telegramId);
    }

    console.log(`[OFERTAS] Buscando ofertas para usuario ${telegramId} en ${fuentes.length} fuentes...`);

    let todasLasOfertas = [];
    const ofertasPorFuente = new Map(); // Para rastrear qué fuentes ya tienen datos

    // 3. Verificar Caché (BD) primero
    for (const fuente of fuentes) {
      const ofertasCache = await obtenerOfertasDeBD(fuente.id);
      if (ofertasCache.length > 0) {
        console.log(`[CACHE] Encontradas ${ofertasCache.length} ofertas recientes para ${fuente.nombre}`);
        ofertasPorFuente.set(fuente.id, ofertasCache);
        todasLasOfertas.push(...ofertasCache);
      }
    }

    // 4. Identificar fuentes que necesitan scraping (sin caché o caché vieja)
    const fuentesParaScrapear = fuentes.filter((f) => !ofertasPorFuente.has(f.id));

    if (fuentesParaScrapear.length > 0) {
      console.log(`[SCRAPER] Iniciando scraping en segundo plano para: ${fuentesParaScrapear.map((f) => f.nombre).join(", ")}`);

      // Lanzar scraping en background (sin await aquí para no bloquear indefinidamente)
      const scrapingPromise = Promise.all(
        fuentesParaScrapear.map(async (fuente) => {
          const nuevasOfertas = await ejecutarScraping(fuente);
          // ejecutarScraping ya guarda en BD, así que solo las devolvemos para uso inmediato
          return { fuenteId: fuente.id, ofertas: nuevasOfertas };
        })
      );

      // 5. Esperar hasta 30 segundos por resultados nuevos
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve("TIMEOUT"), 30000));

      const resultado = await Promise.race([scrapingPromise, timeoutPromise]);

      if (resultado === "TIMEOUT") {
        console.log(`[TIMEOUT] El scraping tardó más de 30s. Se devolverá lo que haya en caché (si hay).`);
        // El scraping sigue corriendo en background y llenará la BD para la próxima.
      } else {
        console.log(`[SCRAPER] Scraping completado a tiempo.`);
        // Agregar las nuevas ofertas al resultado final
        resultado.forEach(({ ofertas }) => {
          todasLasOfertas.push(...ofertas);
        });
      }
    } else {
      console.log(`[CACHE] Todas las fuentes tenían datos recientes. No se requiere scraping.`);
    }

    console.log(`[OFERTAS] Total ofertas disponibles para filtrar: ${todasLasOfertas.length}`);

    // 6. Filtrar ofertas según preferencias
    const ofertasFiltradas = todasLasOfertas.filter((oferta) => {
      // Filtro por precio
      if (oferta.precio_oferta < preferencias.precio_min) return false;
      if (preferencias.precio_max > 0 && oferta.precio_oferta > preferencias.precio_max) return false;

      // Filtro por porcentaje de descuento
      if (oferta.porcentaje_descuento < preferencias.porcentaje_descuento_min) return false; // Nota: en BD se llama porcentaje_descuento, en scraper porcentaje. Ajustar si es necesario.

      // Filtro por categoría
      if (isTodoSelected) return true;
      if (categoriasIds.size === 0) return false;

      const categoriasUsuario = todasCategorias.filter((c) => categoriasIds.has(c.id));
      const textoBusqueda = (oferta.titulo + " " + (oferta.categoria || "")).toLowerCase();
      return categoriasUsuario.some((cat) => textoBusqueda.includes(cat.nombre.toLowerCase()));
    });

    console.log(`[OFERTAS] Total ofertas filtradas: ${ofertasFiltradas.length}`);
    return ofertasFiltradas;
  } catch (error) {
    console.error("Error en cargarOfertas:", error);
    return [];
  }
};
