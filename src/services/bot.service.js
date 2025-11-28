import TelegramBot from "node-telegram-bot-api";
import "dotenv/config";
import { handleStartCommand, handleCargarOfertasCommand } from "../controllers/bot.controller.js";
import { findUsuarioPorTelegramId, actualizarConfigMessageId, obtenerConfigMessageId } from "./usuario.service.js";
import { ROLES } from "../dictionaries/index.js";
import { obtenerCategorias, crearCategoria } from "./categoria.service.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
const miniAppUrl = process.env.MINI_APP_URL;

const userStates = {}; // Seguimos usando userStates para el flujo de admin, pero no para configMessageId

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

let bot;

export const initializeBot = () => {
  if (!token) {
    console.error("Error: El token del bot de Telegram no está configurado.");
    process.exit(1);
  }
  if (!miniAppUrl) {
    console.error("Error: La URL de la Mini App no está configurada en .env (MINI_APP_URL).");
    process.exit(1);
  }

  bot = new TelegramBot(token, { polling: true });

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

      // Guardamos el ID del mensaje del bot en la BD para persistencia
      await actualizarConfigMessageId(chatId, sentMsg.message_id);
      console.log(`[DEBUG PASO 1.3] Guardado configMessageId en BD para ChatID ${chatId}: ${sentMsg.message_id}`);
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
      if (data === "ver_ofertas_ahora") {
        // Importamos dinámicamente para evitar ciclos o lo movemos arriba si es posible
        const { handleVerOfertasAhora } = await import("../controllers/bot.controller.js");
        await handleVerOfertasAhora(bot, msg);
      }
    } catch (error) {
      console.error("Error procesando callback_query:", error);
      bot.sendMessage(chatId, "Ocurrió un error al procesar tu selección. Inténtalo de nuevo.");
    }
  });

  // Listener legacy por si acaso, aunque ya no debería usarse si migramos a HTTP
  bot.on("web_app_data", async (msg) => {
    console.log("\n\n--- [DEBUG LEGACY] Evento 'web_app_data' recibido (ignorar si usas HTTP) ---");
  });

  console.log("Bot de Telegram inicializado y escuchando...");

  return bot;
};

// Nueva función exportada para ser usada por el controlador HTTP
export const procesarFinalizacionConfiguracion = async (telegramId) => {
  const chatId = telegramId; // En chats privados, el chatId es igual al telegramId
  console.log(`[DEBUG FINALIZACION] Iniciando proceso para usuario ${telegramId} (ChatID: ${chatId})`);

  if (!bot) {
    console.error("[DEBUG FINALIZACION ERROR] La instancia del bot no está inicializada.");
    return;
  }

  // Recuperar el ID del mensaje de configuración de la BD
  console.log(`[DEBUG FINALIZACION] Buscando configMessageId en BD para ChatID ${chatId}...`);

  const configMessageId = await obtenerConfigMessageId(chatId);
  console.log(`[DEBUG FINALIZACION] configMessageId recuperado de BD: ${configMessageId}`);

  console.log(`[DEBUG FINALIZACION] Iniciando limpieza de mensajes...`);

  // 1. Borrar el mensaje del botón "Abrir Configuración" (si existe)
  if (configMessageId) {
    console.log(`[DEBUG FINALIZACION] Intentando borrar mensaje de configuración (ID: ${configMessageId})...`);
    await bot
      .deleteMessage(chatId, configMessageId)
      .then(async () => {
        console.log(`[DEBUG FINALIZACION OK] Mensaje de configuración borrado.`);
        // Limpiar el ID en la BD
        await actualizarConfigMessageId(chatId, null);
      })
      .catch((err) => console.warn(`[DEBUG FINALIZACION ERROR] No se pudo borrar mensaje de configuración:`, err.message));
  } else {
    console.warn(`[DEBUG FINALIZACION WARNING] No se encontró configMessageId en BD, no se puede borrar el botón.`);
  }

  console.log("[DEBUG FINALIZACION] Enviando resumen final...");

  // Recuperamos el usuario de la BD para tener los datos reales y evitar errores en registrarOActualizarUsuario
  const usuarioDB = await findUsuarioPorTelegramId(telegramId);

  // Construimos un objeto msg que cumpla con lo que espera registrarOActualizarUsuario
  // (id, first_name, username, is_bot)
  const fakeMsg = {
    chat: { id: chatId },
    from: {
      id: telegramId,
      first_name: usuarioDB?.nombre || "Usuario",
      username: usuarioDB?.username || null,
      is_bot: false,
    },
  };

  await handleStartCommand(bot, fakeMsg);
  console.log("[DEBUG FINALIZACION] Resumen enviado.");
};
