import {
  registrarOActualizarUsuario,
  findUsuarioPorTelegramId,
  obtenerLastSummaryMessageId,
  actualizarLastSummaryMessageId,
} from "../services/usuario.service.js";
import { ROLES } from "../dictionaries/index.js";
import { obtenerPreferencias } from "../services/preferencias.service.js";
import { obtenerCategorias, obtenerCategoriasPorUsuario } from "../services/categoria.service.js";
import { cargarOfertas } from "../services/ofertas.service.js";

const menuPrincipalSimplificadoOptions = {
  reply_markup: {
    inline_keyboard: [[{ text: "🔎 Ver Ofertas Ahora", callback_data: "ver_ofertas_ahora" }]],
  },
};

const menuBienvenidaOptions = {
  reply_markup: {
    inline_keyboard: [[{ text: "🚀 ¡Vamos a configurar!", callback_data: "configurar_preferencias" }]],
  },
};

export const handleStartCommand = async (bot, msg) => {
  const chatId = msg.chat.id;
  const usuarioTelegram = msg.from;

  console.log(`[DEBUG CONTROLLER] handleStartCommand iniciado para usuario ${usuarioTelegram.id}`);

  try {
    await registrarOActualizarUsuario(usuarioTelegram);
    const usuarioDB = await findUsuarioPorTelegramId(usuarioTelegram.id);

    if (!usuarioDB.configuracion_inicial_completa) {
      const mensajeBienvenida = `¡Hola, *${usuarioTelegram.first_name}*! 👋\n\nBienvenido al *Buscador de Ofertas*.\n\nAntes de empezar a enviarte las mejores promociones, necesito saber qué tipo de productos te interesan.\n\n¡Vamos a configurar tus preferencias en un momento!`;
      bot.sendMessage(chatId, mensajeBienvenida, { ...menuBienvenidaOptions, parse_mode: "Markdown" });
      console.log(`[DEBUG CONTROLLER] Enviado mensaje de bienvenida (configuración incompleta).`);
    } else {
      const [preferencias, categoriasSeleccionadasIds, todasCategorias] = await Promise.all([
        obtenerPreferencias(usuarioTelegram.id),
        obtenerCategoriasPorUsuario(usuarioTelegram.id),
        obtenerCategorias(),
      ]);

      let mensaje = `¡Hola de nuevo, *${usuarioTelegram.first_name}*! 🎉\n\n`;
      mensaje += `Aquí está el resumen de tu configuración actual:\n\n`;
      mensaje += `📉 *Descuento mínimo:* ${preferencias.porcentaje_descuento_min}%\n`;
      const precioMaxTexto = preferencias.precio_max >= 10000 ? "Sin límite" : `Q${preferencias.precio_max}`;
      mensaje += `💰 *Rango de precios:* Q${preferencias.precio_min} - ${precioMaxTexto}\n`;

      const nombresCategorias = todasCategorias
        .filter((cat) => categoriasSeleccionadasIds.has(cat.id))
        .map((cat) => `${cat.emoji || ""} ${cat.nombre}`)
        .join(", ");

      mensaje += `🏷️ *Categorías:* ${nombresCategorias || "Ninguna seleccionada"}\n\n`;
      mensaje += `Puedes ajustar esto en cualquier momento entrando al menu y presionando el boton de configuración.`;

      // Limpieza de mensaje anterior de resumen
      const lastSummaryId = await obtenerLastSummaryMessageId(usuarioTelegram.id);
      if (lastSummaryId) {
        try {
          await bot.deleteMessage(chatId, lastSummaryId);
          console.log(`[DEBUG CONTROLLER] Resumen anterior (ID: ${lastSummaryId}) borrado.`);
        } catch (error) {
          console.warn(`[DEBUG CONTROLLER] No se pudo borrar el resumen anterior:`, error.message);
        }
      }

      const sentMsg = await bot.sendMessage(chatId, mensaje, { ...menuPrincipalSimplificadoOptions, parse_mode: "Markdown" });
      console.log(`[DEBUG CONTROLLER] Enviado resumen de configuración. ID: ${sentMsg.message_id}`);

      // Guardar ID del nuevo resumen
      await actualizarLastSummaryMessageId(usuarioTelegram.id, sentMsg.message_id);
    }
  } catch (error) {
    console.error("Error al manejar el comando /start:", error);
    bot.sendMessage(chatId, "Lo siento, ocurrió un error al procesar tu solicitud.");
  }
};

// --- FLUJO DE FILTRADO AVANZADO ---

// --- FLUJO DE FILTRADO AVANZADO ---

// Paso 1: Preguntar cantidad (Dinamico)
export const handleVerOfertasAhora = async (bot, chatId, usuarioTelegram) => {
  const telegramId = usuarioTelegram.id;

  // Aseguramos registro
  await registrarOActualizarUsuario(usuarioTelegram);

  bot.sendMessage(chatId, "🔎 Analizando ofertas disponibles...");

  try {
    // Obtenemos las ofertas primero para saber cuántas hay
    const ofertas = await cargarOfertas(telegramId);
    const total = ofertas.length;

    if (total === 0) {
      return bot.sendMessage(chatId, "😔 No encontré ofertas que coincidan con tus filtros en este momento.");
    }

    // Si son pocas (<= 5), las mandamos de una vez (ordenadas por descuento por defecto)
    if (total <= 5) {
      bot.sendMessage(chatId, `✨ He encontrado ${total} ofertas. Aquí las tienes:`);
      // Reutilizamos la lógica de envío llamando a handleSeleccionOrden con parámetros forzados
      return handleSeleccionOrden(bot, chatId, usuarioTelegram, total, "desc");
    }

    // Si hay más de 5, construimos los botones dinámicamente
    const botones = [];
    const fila1 = [];
    const fila2 = [];

    // Siempre opción de 5
    fila1.push({ text: "5", callback_data: "cantidad_5" });

    if (total > 5) {
      // Si hay más de 5, opción de 10 (o todas si son menos de 10)
      if (total <= 10) {
        fila1.push({ text: `Todas (${total})`, callback_data: `cantidad_${total}` });
      } else {
        fila1.push({ text: "10", callback_data: "cantidad_10" });
      }
    }

    if (total > 10) {
      if (total <= 15) {
        fila2.push({ text: `Todas (${total})`, callback_data: `cantidad_${total}` });
      } else {
        fila2.push({ text: "15", callback_data: "cantidad_15" });
      }
    }

    if (total > 15) {
      if (total <= 20) {
        fila2.push({ text: `Todas (${total})`, callback_data: `cantidad_${total}` });
      } else {
        fila2.push({ text: "20", callback_data: "cantidad_20" });
      }
    }

    // Si hay más de 20, opción de 20 como máximo
    if (total > 20) {
      // Ya se agregó "20" arriba
    }

    if (fila1.length > 0) botones.push(fila1);
    if (fila2.length > 0) botones.push(fila2);

    const options = {
      reply_markup: {
        inline_keyboard: botones,
      },
    };

    bot.sendMessage(chatId, `🔢 He encontrado *${total} ofertas* disponibles.\n¿Cuántas quieres ver?`, {
      parse_mode: "Markdown",
      ...options,
    });
  } catch (error) {
    console.error("Error en handleVerOfertasAhora:", error);
    bot.sendMessage(chatId, "❌ Ocurrió un error al analizar las ofertas.");
  }
};

// Paso 2: Preguntar orden (guardando cantidad en userStates en bot.service.js)
export const handleSeleccionCantidad = async (bot, chatId, cantidad) => {
  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📉 Mayor Descuento", callback_data: "orden_desc" }],
        [{ text: "💰 Mayor Precio", callback_data: "orden_precio" }],
        [{ text: "🎲 Aleatorio", callback_data: "orden_random" }],
      ],
    },
  };

  bot.sendMessage(chatId, `👍 Entendido: *${cantidad} ofertas*.\n\n🔃 ¿Cómo las ordenamos?`, {
    parse_mode: "Markdown",
    ...options,
  });
};

// Paso 3: Mostrar resultados finales
export const handleSeleccionOrden = async (bot, chatId, usuarioTelegram, cantidad, orden) => {
  const telegramId = usuarioTelegram.id;

  bot.sendMessage(chatId, "🔎 Buscando y ordenando ofertas... dame unos segundos.");

  try {
    let ofertas = await cargarOfertas(telegramId);

    if (ofertas.length === 0) {
      return bot.sendMessage(chatId, "😔 No encontré ofertas que coincidan con tus filtros en este momento.");
    }

    // Ordenar
    if (orden === "desc") {
      ofertas.sort((a, b) => b.porcentaje - a.porcentaje);
    } else if (orden === "precio") {
      ofertas.sort((a, b) => b.precio_oferta - a.precio_oferta);
    } else if (orden === "random") {
      ofertas.sort(() => Math.random() - 0.5);
    }

    // Limitar cantidad
    const topOfertas = ofertas.slice(0, cantidad);

    for (const oferta of topOfertas) {
      const ahorro = (oferta.precio_normal - oferta.precio_oferta).toFixed(2);

      const caption =
        `✨ *${oferta.titulo}* ✨\n\n` +
        `❌ Precio Normal: ~Q${oferta.precio_normal}~\n` +
        `💰 Precio Oferta: *Q${oferta.precio_oferta}*\n` +
        `🔥 Ahorras: *${oferta.porcentaje}%* (Q${ahorro})\n\n` +
        `🏷️ Categoría: *${oferta.categoria || "General"}*\n\n` +
        `🔗 [VER OFERTA EN TIENDA](${oferta.enlace})`;

      if (oferta.imagen) {
        await bot.sendPhoto(chatId, oferta.imagen, { caption, parse_mode: "Markdown" });
      } else {
        await bot.sendMessage(chatId, caption, { parse_mode: "Markdown" });
      }
    }

    if (ofertas.length > cantidad) {
      bot.sendMessage(chatId, `... y ${ofertas.length - cantidad} ofertas más disponibles. Vuelve a buscar para ver otras.`);
    }
  } catch (error) {
    console.error("Error al buscar ofertas:", error);
    bot.sendMessage(chatId, "❌ Ocurrió un error al buscar ofertas.");
  }
};

export const handleCargarOfertasCommand = async (bot, msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const usuario = await findUsuarioPorTelegramId(telegramId);

    if (usuario?.rol !== ROLES.ADMIN) {
      bot.sendMessage(chatId, "🚫 No tienes permiso para ejecutar este comando.");
      return;
    }

    bot.sendMessage(chatId, "⚙️ Funcionalidad de carga de ofertas en construcción.");
  } catch (error) {
    console.error("Error al manejar el comando /cargar_ofertas:", error);
    bot.sendMessage(chatId, "❌ Ocurrió un error. Revisa los logs del servidor.");
  }
};
