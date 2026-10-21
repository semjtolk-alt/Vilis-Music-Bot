
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";

const app = express();
app.use(express.json());

const {
  TELEGRAM_BOT_TOKEN,
  OPENAI_API_KEY
} = process.env;

if (!TELEGRAM_BOT_TOKEN || !OPENAI_API_KEY) {
  console.error("Добавь TELEGRAM_BOT_TOKEN и OPENAI_API_KEY в настройки хостинга.");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);
const ai = new OpenAI({ apiKey: OPENAI_API_KEY });

const conversations = new Map();

app.get("/", (_req, res) => {
  res.send("Vilis Music Bot работает!");
});

app.post("/telegram-webhook", async (req, res) => {
  res.sendStatus(200);

  const update = req.body;
  const message = update.message;
  if (!message?.text || !message.chat?.id) return;

  const chatId = message.chat.id;
  const text = message.text.trim();

  if (text === "/start") {
    await bot.sendMessage(
      chatId,
      "🎵 Добро пожаловать в Vilis Music Bot!\n\n" +
      "Я могу общаться с тобой и придумывать тексты песен.\n\n" +
      "Напиши сообщение или используй /song для песни и /help для помощи."
    );
    return;
  }

  if (text === "/help") {
    await bot.sendMessage(
      chatId,
      "Команды:\n/start — запуск\n/song — придумать песню\n/poem — написать стих\n/reset — очистить историю"
    );
    return;
  }

  if (text === "/reset") {
    conversations.delete(chatId);
    await bot.sendMessage(chatId, "История диалога очищена.");
    return;
  }

  const mode = text.startsWith("/song")
    ? "Напиши оригинальный текст песни по запросу пользователя."
    : text.startsWith("/poem")
    ? "Напиши оригинальное стихотворение по запросу пользователя."
    : "Ты дружелюбный ИИ-помощник Vilis Music Bot. Отвечай ясно и полезно.";

  const prompt = text.replace(/^\/(song|poem)\s*/, "").trim();
  const history = conversations.get(chatId) || [];

  try {
    await bot.sendChatAction(chatId, "typing");

    const response = await ai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions: mode,
      input: [
        ...history,
        { role: "user", content: prompt || text }
      ]
    });

    const answer = response.output_text || "Не получилось сформировать ответ. Попробуй ещё раз.";

    conversations.set(chatId, [
      ...history,
      { role: "user", content: prompt || text },
      { role: "assistant", content: answer }
    ].slice(-12));

    for (let i = 0; i < answer.length; i += 4000) {
      await bot.sendMessage(chatId, answer.slice(i, i + 4000));
    }
  } catch (error) {
    console.error("Ошибка ИИ:", error.message);
    await bot.sendMessage(
      chatId,
      "Не удалось получить ответ от ИИ. Проверь настройки ключа API и доступ к модели."
    );
  }
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Vilis Music Bot запущен на порту ${port}`);
});
