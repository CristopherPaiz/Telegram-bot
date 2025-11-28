import TelegramBot from "node-telegram-bot-api";
import "dotenv/config";
import { handleStartCommand, handleCargarOfertasCommand } from "../controllers/bot.controller.js";
import { findUsuarioPorTelegramId, actualizarNombreUsuario, marcarConfiguracionCompleta } from "./usuario.service.js";
import { ROLES } from "../dictionaries/index.js";
import { obtenerCategorias, crearCategoria, actualizarCategoriasUsuario } from "./categoria.service.js";
import { actualizarPreferencias } from "./preferencias.service.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
const miniAppUrl = process.env.MINI_APP_URL;

const userStates = {};

const menuConfiguracionOptions = {
  reply_markup: {
    inline_keyboard: [[{ text: "🛠️ Abrir Configuración", web_app: { url: miniAppUrl } }]],
  },
};

const menuAdminOptions = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "➕ Añadir Categoría", callback_data: "admin_add_cat" }],
      [{ text: "🏷️ Gestionar Etiquetas", callback_data: "admin_manage_tags" }],
    ],
  },
};

export const initializeBot = () => {
  if (!token) {
    console.error("Error: El token del bot de Telegram no está configurado.");
    process.exit(1);
  }
  if (!miniAppUrl) {
    console.error("Error: La URL de la Mini App no está configurada en .env (MINI_APP_URL).");
    process.exit(1);
  }

  const bot = new TelegramBot(token, { polling: true });

  bot.on("polling_error", (error) => {
    console.log(`[POLLING_ERROR] Código: ${error.code} | Mensaje: ${error.message}`);
  });

  bot.onText(/\/start/, (msg) => {
    console.log(`[DEBUG PASO 0] Recibido /start de ChatID: ${msg.chat.id}`);
    delete userStates[msg.chat.id];
    handleStartCommand(bot, msg);
  });

  bot.onText(/\/configurar/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`[DEBUG PASO 1.0] Recibido comando /configurar. ChatID: ${chatId}, MessageID: ${msg.message_id}`);

    // 1. Borrar el comando del usuario para limpiar el chat
    try {
      await bot.deleteMessage(chatId, msg.message_id);
      console.log(`[DEBUG PASO 1.1] Comando /configurar borrado exitosamente.`);
    } catch (error) {
      console.error(`[DEBUG PASO 1.1 ERROR] No se pudo borrar el comando /configurar:`, error.message);
    }

    // 2. Enviar el mensaje con el botón y guardar su ID
    try {
      const sentMsg = await bot.sendMessage(chatId, "🛠️ *Modo de Configuración*\n\nPulsa el botón para abrir tus preferencias.", {
        parse_mode: "Markdown",
        ...menuConfiguracionOptions,
      });
      console.log(`[DEBUG PASO 1.2] Mensaje de configuración enviado. MessageID: ${sentMsg.message_id}`);

      // Guardamos el ID del mensaje del bot para borrarlo luego
      if (!userStates[chatId]) userStates[chatId] = {};
      userStates[chatId].configMessageId = sentMsg.message_id;
      console.log(`[DEBUG PASO 1.3] Guardado configMessageId en memoria para ChatID ${chatId}: ${sentMsg.message_id}`);
      console.log(`[DEBUG PASO 1.3 STATE] Estado actual del usuario:`, JSON.stringify(userStates[chatId]));
    } catch (error) {
      console.error(`[DEBUG PASO 1.2 ERROR] Fallo al enviar mensaje de configuración:`, error.message);
    }
  });

  bot.onText(/\/cargar_ofertas/, (msg) => {
    handleCargarOfertasCommand(bot, msg);
  });

  bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const usuario = await findUsuarioPorTelegramId(msg.from.id);
    if (usuario?.rol !== ROLES.ADMIN) {
      return bot.sendMessage(chatId, "🚫 Acceso denegado.");
    }
    bot.sendMessage(chatId, "👑 *Panel de Administración*\n\nSelecciona una opción:", {
      ...menuAdminOptions,
      parse_mode: "Markdown",
    });
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const state = userStates[chatId];
    if (!state || !state.admin_action || (msg.text && msg.text.startsWith("/"))) return;
    const adminId = msg.from.id;
    const adminUser = await findUsuarioPorTelegramId(adminId);
    if (adminUser?.rol !== ROLES.ADMIN) return;
    try {
      if (state.admin_action === "add_cat_name") {
        userStates[chatId] = { admin_action: "add_cat_emoji", nombre: msg.text };
        bot.sendMessage(chatId, "👍 Nombre guardado. Ahora, envía el emoji para esta categoría (o escribe 'no' si no quieres uno).");
      } else if (state.admin_action === "add_cat_emoji") {
        const emoji = msg.text.toLowerCase() === "no" ? null : msg.text;
        userStates[chatId] = { admin_action: "add_cat_parent", nombre: state.nombre, emoji };
        const categorias = await obtenerCategorias();
        const teclado = categorias.filter((c) => !c.padre_id).map((c) => [{ text: c.nombre, callback_data: `set_parent_${c.id}` }]);
        teclado.unshift([{ text: " ninguna (es categoría principal)", callback_data: "set_parent_null" }]);
        bot.sendMessage(chatId, "✨ Emoji guardado. ¿Esta es una subcategoría de alguna de las siguientes?", {
          reply_markup: { inline_keyboard: teclado },
        });
      }
    } catch (error) {
      console.error("Error en el flujo de admin:", error);
      bot.sendMessage(chatId, "❌ Ocurrió un error. Proceso cancelado.");
      delete userStates[chatId];
    }
  });

  bot.on("callback_query", async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = msg.chat.id;
    bot.answerCallbackQuery(callbackQuery.id);
    try {
      if (data === "admin_add_cat") {
        userStates[chatId] = { admin_action: "add_cat_name" };
        return bot.sendMessage(chatId, "✏️ Introduce el nombre para la nueva categoría:");
      }
      if (data.startsWith("set_parent_")) {
        const state = userStates[chatId];
        if (!state || state.admin_action !== "add_cat_parent") return;
        const padre_id = data === "set_parent_null" ? null : parseInt(data.replace("set_parent_", ""), 10);
        const { nombre, emoji } = state;
        await crearCategoria({ nombre, emoji, padre_id });
        bot.editMessageText(`✅ ¡Categoría "*${nombre}*" creada con éxito!`, {
          chat_id: chatId,
          message_id: msg.message_id,
          parse_mode: "Markdown",
        });
        delete userStates[chatId];
        return;
      }
      if (data === "configurar_preferencias") {
        await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
        await bot.sendMessage(chatId, "Pulsa el botón a continuación para configurar tus preferencias.", menuConfiguracionOptions);
      }
    } catch (error) {
      console.error("Error procesando callback_query:", error);
      bot.sendMessage(chatId, "Ocurrió un error al procesar tu selección. Inténtalo de nuevo.");
    }
  });

  bot.on("web_app_data", async (msg) => {
    console.log("\n\n--- [DEBUG PASO 2.0] INICIO: Evento 'web_app_data' recibido ---");
    console.log("[DEBUG PASO 2.0 DATA] Objeto 'msg' completo:", JSON.stringify(msg, null, 2));

    const chatId = msg.chat.id;
    const originalMessageId = msg.message_id;
    const telegramId = msg.from.id;

    console.log(`[DEBUG PASO 2.1] Datos extraídos: chatId=${chatId}, messageId=${originalMessageId}, telegramId=${telegramId}`);

    try {
      const data = JSON.parse(msg.web_app_data.data);
      console.log("[DEBUG PASO 2.2] Datos de la Mini App parseados:", data);

      if (data.type === "save_configuration" && data.payload) {
        console.log("[DEBUG PASO 2.3] Tipo de evento 'save_configuration' confirmado. Procediendo...");
        const { nombre, porcentajeDescuento, precioMin, precioMax, selectedIds } = data.payload;

        const preferencias = {
          porcentaje_descuento_min: porcentajeDescuento,
          precio_min: precioMin,
          precio_max: precioMax,
        };

        console.log("[DEBUG PASO 2.4] Guardando configuración en BD...");
        await Promise.all([
          actualizarNombreUsuario(telegramId, nombre),
          actualizarPreferencias(telegramId, preferencias),
          actualizarCategoriasUsuario(telegramId, selectedIds),
          marcarConfiguracionCompleta(telegramId),
        ]);
        console.log("[DEBUG PASO 2.5] Configuración guardada en BD.");

        // Recuperar el ID del mensaje de configuración guardado previamente
        console.log(`[DEBUG PASO 2.6] Buscando estado para ChatID ${chatId}...`);
        console.log(`[DEBUG PASO 2.6 STATE] Estado completo:`, JSON.stringify(userStates[chatId]));

        const configMessageId = userStates[chatId]?.configMessageId;
        console.log(`[DEBUG PASO 2.7] configMessageId recuperado: ${configMessageId}`);

        console.log(`[DEBUG PASO 3.0] Iniciando limpieza de mensajes...`);

        // 1. Borrar el mensaje del botón "Abrir Configuración" (si existe)
        if (configMessageId) {
          console.log(`[DEBUG PASO 3.1] Intentando borrar mensaje de configuración (ID: ${configMessageId})...`);
          await bot
            .deleteMessage(chatId, configMessageId)
            .then(() => console.log(`[DEBUG PASO 3.1 OK] Mensaje de configuración borrado.`))
            .catch((err) => console.warn(`[DEBUG PASO 3.1 ERROR] No se pudo borrar mensaje de configuración:`, err.message));
        } else {
          console.warn(`[DEBUG PASO 3.1 WARNING] No se encontró configMessageId, no se puede borrar el botón.`);
        }

        // 2. Borrar el mensaje de servicio "Data sent" (el actual web_app_data)
        if (originalMessageId) {
          console.log(`[DEBUG PASO 3.2] Intentando borrar mensaje de servicio (ID: ${originalMessageId})...`);
          await bot
            .deleteMessage(chatId, originalMessageId)
            .then(() => console.log(`[DEBUG PASO 3.2 OK] Mensaje de servicio borrado.`))
            .catch((err) => console.warn(`[DEBUG PASO 3.2 ERROR] No se pudo borrar mensaje de servicio:`, err.message));
        } else {
          console.warn(`[DEBUG PASO 3.2 WARNING] No hay originalMessageId para borrar.`);
        }

        // Limpiar estado
        if (userStates[chatId]) {
          delete userStates[chatId].configMessageId;
          console.log(`[DEBUG PASO 3.3] Estado limpiado (configMessageId eliminado).`);
        }

        console.log("[DEBUG PASO 4.0] Enviando resumen final...");
        await handleStartCommand(bot, { chat: { id: chatId }, from: msg.from });
        console.log("[DEBUG PASO 4.1] Resumen enviado.");
      } else {
        console.warn("[DEBUG WARNING] Se recibió 'web_app_data' pero no era 'save_configuration'.");
      }
    } catch (error) {
      console.error("[DEBUG ERROR FATAL] Error en manejador 'web_app_data':", error);
      bot.sendMessage(chatId, "Hubo un error crítico al procesar tu configuración.");
    }
    console.log("--- [DEBUG FIN] Evento 'web_app_data' procesado ---\n\n");
  });

  console.log("Bot de Telegram inicializado y escuchando...");

  return bot;
};
