import { obtenerFuentesPorUsuario, asignarFuentesPorDefecto } from "./fuentes.service.js";
import { ejecutarScraping } from "./scraper.service.js";
import { obtenerPreferencias, crearPreferenciasDefault } from "./preferencias.service.js";
import { obtenerCategoriasPorUsuario, obtenerCategorias } from "./categoria.service.js";

export const cargarOfertas = async (telegramId) => {
  try {
    // 1. Obtener preferencias del usuario
    let preferencias = await obtenerPreferencias(telegramId);

    // Si no existen, las creamos por defecto y volvemos a consultar
    if (!preferencias) {
      console.log(`[OFERTAS] Usuario ${telegramId} sin preferencias. Creando default...`);
      await crearPreferenciasDefault(telegramId);
      preferencias = await obtenerPreferencias(telegramId);
    }

    if (!preferencias) throw new Error("No se pudieron cargar las preferencias.");

    // 2. Obtener categorías seleccionadas (Set de IDs)
    const categoriasIds = await obtenerCategoriasPorUsuario(telegramId);

    // Verificar si la categoría "TODO" está seleccionada
    // Primero necesitamos saber el ID de "TODO"
    const todasCategorias = await obtenerCategorias();
    const todoCategory = todasCategorias.find((c) => c.nombre === "TODO");
    const isTodoSelected = todoCategory && categoriasIds.has(todoCategory.id);

    if (isTodoSelected) {
      console.log(`[OFERTAS] Categoría TODO seleccionada. Se ignorarán filtros de categoría.`);
    }

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

      // Filtro por categoría
      // Si "TODO" está seleccionado, saltamos este filtro
      if (isTodoSelected) return true;

      // Si no hay categorías seleccionadas, ¿qué hacemos?
      // Asumimos que si no seleccionó nada, no quiere nada o quiere todo?
      // Por seguridad, si no hay selección y no es TODO, filtramos estricto (o sea, nada)
      if (categoriasIds.size === 0) return false;

      // Lógica de filtrado por texto (simple)
      // Si el item tiene categoría, buscamos si coincide con alguna de las seleccionadas
      // Esto es complejo porque el scraper devuelve strings y la BD tiene IDs.
      // Por ahora, como MVP, si no es TODO, requerimos coincidencia parcial en nombre o categoría
      const categoriasUsuario = todasCategorias.filter((c) => categoriasIds.has(c.id));
      const textoBusqueda = (oferta.titulo + " " + oferta.categoria).toLowerCase();

      const coincide = categoriasUsuario.some((cat) => textoBusqueda.includes(cat.nombre.toLowerCase()));
      return coincide;
    });

    console.log(`[OFERTAS] Total ofertas filtradas: ${ofertasFiltradas.length}`);

    return ofertasFiltradas;
  } catch (error) {
    console.error("Error en cargarOfertas:", error);
    return [];
  }
};
