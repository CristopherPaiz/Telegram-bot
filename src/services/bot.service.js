import TelegramBot from "node-telegram-bot-api";
import "dotenv/config";
import { handleStartCommand, handleCargarOfertasCommand } from "../controllers/bot.controller.js";
import { findUsuarioPorTelegramId, marcarConfiguracionCompleta } from "./usuario.service.js";
import { ROLES } from "../dictionaries/index.js";
import { obtenerCategorias, crearCategoria } from "./categoria.service.js";

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

  bot.onText(/\/start/, (msg) => {
    delete userStates[msg.chat.id];
    handleStartCommand(bot, msg);
  });

  bot.onText(/\/configurar/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "🛠️ *Modo de Configuración*\n\nPulsa el botón para abrir tus preferencias.", {
      parse_mode: "Markdown",
      ...menuConfiguracionOptions,
    });
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

    if (!state || !state.admin_action || msg.text.startsWith("/")) return;

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
    const chatId = msg.chat.id;
    const originalMessageId = msg.message_id; // ESTA ES LA CORRECCIÓN CLAVE

    try {
      const data = JSON.parse(msg.web_app_data.data);
      if (data.status === "success") {
        if (originalMessageId) {
          await bot.deleteMessage(chatId, originalMessageId).catch(() => {
            // Ignorar si el mensaje ya no existe.
          });
        }
        // Llamar a handleStartCommand para enviar el resumen actualizado.
        await handleStartCommand(bot, { chat: { id: chatId }, from: msg.from });
      }
    } catch (error) {
      console.error("Error procesando web_app_data:", error);
      bot.sendMessage(chatId, "Hubo un error al guardar tu configuración.");
    }
  });

  console.log("Bot de Telegram inicializado y escuchando...");

  return bot;
};
