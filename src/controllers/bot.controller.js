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

export const handleVerOfertasAhora = async (bot, msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  bot.sendMessage(chatId, "🔎 Buscando las mejores ofertas para ti... dame unos segundos.");

  try {
    const ofertas = await cargarOfertas(telegramId);

    if (ofertas.length === 0) {
      return bot.sendMessage(chatId, "😔 No encontré ofertas que coincidan con tus filtros en este momento.");
    }

    // Enviar las primeras 5 ofertas para no saturar
    const topOfertas = ofertas.slice(0, 5);

    for (const oferta of topOfertas) {
      const caption =
        `🔥 *${oferta.titulo}*\n\n` +
        `💵 Precio Oferta: *Q${oferta.precio_oferta}*\n` +
        `❌ Precio Normal: ~Q${oferta.precio_normal}~\n` +
        `📉 Descuento: *${oferta.porcentaje}% OFF*\n\n` +
        `[Ver en Tienda](${oferta.enlace})`;

      if (oferta.imagen) {
        await bot.sendPhoto(chatId, oferta.imagen, { caption, parse_mode: "Markdown" });
      } else {
        await bot.sendMessage(chatId, caption, { parse_mode: "Markdown" });
      }
    }

    if (ofertas.length > 5) {
      bot.sendMessage(chatId, `... y ${ofertas.length - 5} ofertas más encontradas.`);
    }
  } catch (error) {
    console.error("Error al buscar ofertas:", error);
    bot.sendMessage(chatId, "❌ Ocurrió un error al buscar ofertas.");
  }
};

export const handleCargarOfertasCommand = async (bot, msg) => {
  // ... (código existente)

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
