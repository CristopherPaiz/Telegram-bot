import TelegramBot from "node-telegram-bot-api";
import "dotenv/config";
import { handleStartCommand, handleCargarOfertasCommand } from "../controllers/bot.controller.js";
import { actualizarPreferencias } from "./preferencias.service.js";
import { findUsuarioPorTelegramId, marcarConfiguracionCompleta } from "./usuario.service.js";
import { ROLES } from "../dictionaries/index.js";
import { obtenerCategorias, crearCategoria, obtenerCategoriasPorUsuario, togglePreferenciaCategoria } from "./categoria.service.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
const miniAppUrl = process.env.MINI_APP_URL;

const userStates = {};

// ... (Todos los menús de configuración de usuario se mantienen igual)
const menuConfiguracionOptions = (haHechoCambios) => ({
  reply_markup: {
    inline_keyboard: [
      [{ text: "📉 Porcentaje de Descuento", callback_data: "config_descuento" }],
      [{ text: "💰 Rango de Precios", callback_data: "config_precios" }],
      [{ text: "🏷️ Categorías (App)", web_app: { url: miniAppUrl } }],
      [{ text: haHechoCambios ? "✅ ¡Listo! Guardar y Terminar" : "✅ Terminar con valores por defecto", callback_data: "terminar_config" }],
    ],
  },
});
const menuDescuentoOptions = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "10%+", callback_data: "set_desc_10" },
        { text: "25%+", callback_data: "set_desc_25" },
        { text: "40%+", callback_data: "set_desc_40" },
      ],
      [
        { text: "50%+", callback_data: "set_desc_50" },
        { text: "70%+", callback_data: "set_desc_70" },
        { text: "Cualquiera", callback_data: "set_desc_0" },
      ],
      [{ text: "🔙 Volver", callback_data: "configurar_preferencias" }],
    ],
  },
};
const preciosMinimos = [0, 100, 250, 500, 1000, 2000];
const preciosMaximosBase = [250, 500, 1000, 2000, 5000, 10000, 20000, 999999];
const generarMenuPrecioMin = () => ({
  reply_markup: {
    inline_keyboard: [
      preciosMinimos.map((precio) => ({
        text: `Q${precio}`,
        callback_data: `set_precio_min_${precio}`,
      })),
      [{ text: "🔙 Volver", callback_data: "configurar_preferencias" }],
    ],
  },
});
const generarMenuPrecioMax = (precioMin) => {
  const opcionesMax = preciosMaximosBase.filter((pMax) => pMax > precioMin);
  const teclado = [];
  let fila = [];
  for (const precio of opcionesMax) {
    fila.push({
      text: precio === 999999 ? "Sin límite" : `Q${precio}`,
      callback_data: `set_precio_max_${precio}`,
    });
    if (fila.length === 3) {
      teclado.push([...fila]);
      fila = [];
    }
  }
  if (fila.length > 0) {
    teclado.push(fila);
  }
  teclado.push([{ text: "🔙 Volver", callback_data: "config_precios" }]);
  return { reply_markup: { inline_keyboard: teclado } };
};
// ... (Fin de los menús de usuario)

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

  // ... (Listeners de /start, /configurar, /cargar_ofertas se mantienen igual)
  bot.onText(/\/start/, (msg) => {
    delete userStates[msg.chat.id];
    handleStartCommand(bot, msg);
  });
  bot.onText(/\/configurar/, (msg) => {
    const chatId = msg.chat.id;
    delete userStates[chatId];
    userStates[chatId] = { haHechoCambios: true };
    bot.sendMessage(chatId, "🛠️ *Modo de Configuración*\n\nSelecciona la preferencia que deseas ajustar.", {
      parse_mode: "Markdown",
      ...menuConfiguracionOptions(true),
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

  bot.on("callback_query", async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = msg.chat.id;
    const fromId = callbackQuery.from.id;

    bot.answerCallbackQuery(callbackQuery.id);

    // Lógica de Admin
    if (data === "admin_add_cat") {
      userStates[chatId] = { admin_action: "add_cat_name" };
      return bot.sendMessage(chatId, "✏️ Introduce el nombre para la nueva categoría:");
    }

    // ... (Toda la lógica de callback_query para usuarios se mantiene igual)
    try {
      if (data === "configurar_preferencias") {
        if (!userStates[chatId]) userStates[chatId] = {};
        const haHechoCambios = userStates[chatId]?.haHechoCambios || false;
        bot.editMessageText("Aquí puedes ajustar tus preferencias. Cuando termines, pulsa 'Terminar'.", {
          chat_id: chatId,
          message_id: msg.message_id,
          ...menuConfiguracionOptions(haHechoCambios),
        });
      } else if (data === "terminar_config") {
        if (!userStates[chatId]?.haHechoCambios) {
          bot.sendMessage(
            chatId,
            "👍 ¡Entendido! Hemos establecido las preferencias por defecto por ti.\n\nRecuerda que puedes cambiarlas cuando quieras usando el comando /configurar."
          );
        }
        await marcarConfiguracionCompleta(fromId);
        bot.deleteMessage(chatId, msg.message_id).catch(() => {});
        delete userStates[chatId];
        await handleStartCommand(bot, { ...msg, from: callbackQuery.from });
      } else if (data === "config_descuento") {
        bot.editMessageText("📉 Elige el *descuento mínimo* que te interesa:", {
          chat_id: chatId,
          message_id: msg.message_id,
          parse_mode: "Markdown",
          ...menuDescuentoOptions,
        });
      } else if (data.startsWith("set_desc_")) {
        userStates[chatId] = { ...userStates[chatId], haHechoCambios: true };
        const descuento = parseInt(data.replace("set_desc_", ""), 10);
        await actualizarPreferencias(fromId, { porcentaje_descuento_min: descuento });
        bot.editMessageText(`✅ Descuento fijado en *${descuento}%*.\n\nPuedes ajustar otro valor o terminar la configuración.`, {
          chat_id: chatId,
          message_id: msg.message_id,
          parse_mode: "Markdown",
          ...menuConfiguracionOptions(true),
        });
      } else if (data === "config_precios") {
        userStates[chatId] = { ...userStates[chatId], a_espera_de: "precio_max" };
        bot.editMessageText("💰 Primero, elige un *precio mínimo*:", {
          chat_id: chatId,
          message_id: msg.message_id,
          parse_mode: "Markdown",
          ...generarMenuPrecioMin(),
        });
      } else if (data.startsWith("set_precio_min_")) {
        const precioMin = parseInt(data.replace("set_precio_min_", ""), 10);
        userStates[chatId].precioMin = precioMin;
        bot.editMessageText(`Mínimo: *Q${precioMin}*.\n\nAhora, elige un *precio máximo*:`, {
          chat_id: chatId,
          message_id: msg.message_id,
          parse_mode: "Markdown",
          ...generarMenuPrecioMax(precioMin),
        });
      } else if (data.startsWith("set_precio_max_")) {
        userStates[chatId] = { ...userStates[chatId], haHechoCambios: true };
        const precioMax = parseInt(data.replace("set_precio_max_", ""), 10);
        const precioMin = userStates[chatId]?.precioMin;

        if (typeof precioMin !== "number") {
          bot.sendMessage(chatId, "Hubo un error, por favor empieza de nuevo desde /configurar.");
          return;
        }

        await actualizarPreferencias(fromId, { precio_min: precioMin, precio_max: precioMax });
        delete userStates[chatId].precioMin;
        const precioMaxTexto = precioMax === 999999 ? "Sin límite" : `Q${precioMax}`;
        bot.editMessageText(`✅ Rango de precios fijado en *Q${precioMin} - ${precioMaxTexto}*.\n\nPuedes ajustar otro valor o terminar.`, {
          chat_id: chatId,
          message_id: msg.message_id,
          parse_mode: "Markdown",
          ...menuConfiguracionOptions(true),
        });
      }
    } catch (error) {
      console.error("Error procesando callback_query de usuario:", error);
      bot.sendMessage(chatId, "Ocurrió un error al procesar tu selección. Inténtalo de nuevo.");
    }
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
    const data = callbackQuery.data;
    if (!data.startsWith("set_parent_")) return;

    const chatId = callbackQuery.message.chat.id;
    const state = userStates[chatId];
    if (!state || state.admin_action !== "add_cat_parent") return;

    bot.answerCallbackQuery(callbackQuery.id);

    try {
      const padre_id = data === "set_parent_null" ? null : parseInt(data.replace("set_parent_", ""), 10);
      const { nombre, emoji } = state;

      await crearCategoria({ nombre, emoji, padre_id });

      bot.editMessageText(`✅ ¡Categoría "*${nombre}*" creada con éxito!`, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
      });
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    } finally {
      delete userStates[chatId];
    }
  });

  // ... (Listener de web_app_data se mantiene igual)
  bot.on("web_app_data", async (msg) => {
    const chatId = msg.chat.id;
    const fromId = msg.from.id;
    try {
      const data = JSON.parse(msg.web_app_data.data);
      const { selectedIds } = data;

      const categoriasActuales = await obtenerCategoriasPorUsuario(fromId);

      const paraAgregar = selectedIds.filter((id) => !categoriasActuales.has(id));
      const paraEliminar = [...categoriasActuales].filter((id) => !selectedIds.includes(id));

      for (const id of paraAgregar) {
        await togglePreferenciaCategoria(fromId, id);
      }
      for (const id of paraEliminar) {
        await togglePreferenciaCategoria(fromId, id);
      }

      userStates[chatId] = { ...userStates[chatId], haHechoCambios: true };
      bot.sendMessage(chatId, `✅ ¡Tus categorías han sido actualizadas!`);
    } catch (error) {
      console.error("Error procesando web_app_data:", error);
      bot.sendMessage(chatId, "Hubo un error al guardar tus categorías.");
    }
  });

  console.log("Bot de Telegram inicializado y escuchando...");

  return bot;
};
