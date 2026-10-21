
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";

const app = express();
const token = process.env.TELEGRAM_BOT_TOKEN;
const apiKey = process.env.OPENAI_API_KEY;

if (!token || !apiKey) {
  console.error("Не заданы секретные переменные");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const ai = new OpenAI({ apiKey });
const histories = new Map();

app.get("/", (_req, res) => {
  res.send("Vilis Music Bot работает!");
});

bot.on("message", async (msg) => {
  if (!msg.text || !msg.chat?.id) return;

  const id = msg.chat.id;
  const text = msg.text.trim();

  try {
    if (text === "/start") {
      await bot.sendMessage(
        id,
        "🎵 Привет! Это Vilis Music Bot!\n\n" +
        "Я могу общаться и придумывать песни.\n" +
        "/song — написать песню\n" +
        "/poem — написать стих\n" +
        "/reset — очистить историю"
      );
      return;
    }

    if (text === "/reset") {
      histories.delete(id);
      await bot.sendMessage(id, "История очищена.");
      return;
    }

    let instructions =
      "Ты дружелюбный ИИ-помощник Vilis Music Bot. Отвечай по-русски.";

    let prompt = text;

    if (text.startsWith("/song")) {
      instructions = "Пиши оригинальные тексты песен.";
      prompt = text.slice(5).trim() || "Придумай оригинальную песню.";
    } else if (text.startsWith("/poem")) {
      instructions = "Пиши оригинальные стихотворения.";
      prompt = text.slice(5).trim() || "Придумай стихотворение.";
    }

    await bot.sendChatAction(id, "typing");

    const history = histories.get(id) || [];
    const result = await ai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions,
      input: [
        ...history,
        { role: "user", content: prompt }
      ]
    });

    const answer = result.output_text || "Не получилось сформировать ответ.";

    histories.set(id, [
      ...history,
      { role: "user", content: prompt },
      { role: "assistant", content: answer }
    ].slice(-12));

    for (let i = 0; i < answer.length; i += 4000) {
      await bot.sendMessage(id, answer.slice(i, i + 4000));
    }
  } catch (error) {
    console.error("Ошибка:", error.message);
    await bot.sendMessage(
      id,
      "Ошибка ответа. Проверь ключ API и журналы Render."
    ).catch(() => {});
  }
});

bot.on("polling_error", (error) => {
  console.error("Ошибка Telegram:", error.message);
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log("Vilis Music Bot запущен на порту " + port);
});
