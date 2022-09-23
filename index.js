const fetch = (...args) =>  import("node-fetch").then(({ default: fetch }) => fetch(...args));
import TeleBot from "telebot";
import sqlite3 from "sqlite3";
import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TeleBot(TOKEN);

import { open } from "sqlite";

bot.on(["/start"], async (msg) => {
  // find user in database with telegram_id
  const telegram_id = msg.from.id;
  const db = await open({
    filename: "./login.db",
    driver: sqlite3.Database,
  });
  let user = null;
  try {
    user = await db.get("SELECT * FROM users WHERE telegram_id = ?", [
      telegram_id,
    ]);
  } catch (err) {
    console.log(err);
  }
  if (!user) {
    return bot.sendMessage(
      msg.from.id,
      "You are not logged in, please use /login command to login",
      { parseMode: "HTML" },
    );
  }
  const listCommand = `
    <b>/start</b> - Start command to get you start.
  <b>/categories</b> - List category of blog.
  <b>/posts</b> - List posts of blog.
  <b>/logut</b> - Logout command to de-active session.
  <b>/help</b> - Type help to list all command
  `;
  bot.sendMessage(msg.from.id, listCommand, { parseMode: "HTML" });
  db.close();
  return;
});

bot.on(["/logout"], async (msg) => {
  await bot.sendMessage(msg.from.id, "Logging out...")
  const db = await open({
    filename: "./login.db",
    driver: sqlite3.Database,
  });
  await db.exec("DELETE FROM users WHERE telegram_id = ?", [msg.from.id.toString()]);
  await db.close();
  return bot.sendMessage(msg.from.id, "Logged out");
})

bot.on(["/categories"], async (msg) => {
  const db = await open({
    filename: "./login.db",
    driver: sqlite3.Database,
  });
  const user = await db.get('SELECT * FROM users WHERE telegram_id = ?', [msg.from.id]);
  const category = await fetch("https://kairete.net/api/blog-categories", {
    method: "GET",
    headers: {
      "XF-Api-Key": "Bj-iF2DqxqJcBEolg9H6Qjp94ekWVM1Y",
      "XF-Api-User": user.user_id,
    },
  });
  if (category.errors)
    return bot.sendMessage(msg.from.id, "Error category API");
  const categoryJSON = await category.json();
  let { categories } = categoryJSON;
  categories = categories.map((category) => {
    return {
      id: category.category_id,
      name: category.title,
    };
  });
  // split categories to array of 2-element array
  const categoriesSplit = [];
  for (let i = 0; i < categories.length; i += 2) {
    categoriesSplit.push(categories.slice(i, i + 2));
  }
  const replyMarkup = bot.inlineKeyboard([
    ...categoriesSplit.map((category) => {
      if (category.length === 1) {
        return [
          bot.inlineButton(category[0].name, {
            callback: JSON.stringify({
              categoryId: category[0].id,
              userId: user.user_id,
            }),
          }),
        ];
      } else {
        return [
          bot.inlineButton(category[0].name, {
            callback: JSON.stringify({
              categoryId: category[0].id,
              userId: user.user_id,
            }),
          }),
          bot.inlineButton(category[1].name, {
            callback: JSON.stringify({
              categoryId: category[1].id,
              userId: user.user_id,
            }),
          }),
        ];
      }
    }),
    [bot.inlineButton("All", { callback: {categoriId: -1, userId: user.user_id} })],
  ]);
  db.close()
  return bot.sendMessage(msg.from.id, "Choose category:", { replyMarkup });
});

bot.on(["/login"], async (msg) => {
  const loginCredentials = msg.text.split(" ")[1].split("||");
  const username = loginCredentials[0];
  const password = loginCredentials[1];
  // fake time consuming task
  bot.sendMessage(msg.from.id, "Checking your credentials...");
  const formData = new URLSearchParams();
  formData.append("login", username);
  formData.append("password", password);
  const data = await fetch("https://www.kairete.net/api/auth", {
    method: "POST",
    headers: {
      "XF-Api-Key": "Bj-iF2DqxqJcBEolg9H6Qjp94ekWVM1Y",
    },
    body: formData,
  });
  if (data.errors) return bot.sendMessage(msg.from.id, "Invalid credentials");
  const db = await open({
    filename: "./login.db",
    driver: sqlite3.Database,
  });
  const dataJSON = await data.json();
  const user = await db.get(
    "SELECT * FROM users WHERE user_id = ? AND telegram_id = ?",
    [dataJSON.user.user_id, msg.from.id],
  );
  if (user) {
    await db.close();
    return bot.sendMessage(
      msg.from.id,
      `Welcome ${username}!, your tele_id is ${msg.from.id}}`,
    );
  } else {
    await db.run("INSERT INTO users (user_id, telegram_id) VALUES (?, ?)", [
      dataJSON.user.user_id,
      msg.from.id,
    ]);
    await db.close();
    return bot.sendMessage(
      msg.from.id,
      `Welcome ${username}!, your tele_id is ${msg.from.id}`,
    );
  }
});

bot.on("callbackQuery", async (msg) => {
  const msgData = JSON.parse(msg.data);
  let params = {};
  if (msgData.categoryId === -1) {
    // get all category
    const category = await fetch("https://kairete.net/api/blog-categories", {
      method: "GET",
      headers: {
        "XF-Api-Key": "Bj-iF2DqxqJcBEolg9H6Qjp94ekWVM1Y",
        "XF-Api-User": msgData.userId,
      },
    });
    if (category.errors)
      return bot.sendMessage(msg.from.id, "Error category API");
    const categoryJSON = await category.json();
    let { categories } = categoryJSON;
    categories = categories.map((category) => {
      return {
        id: category.category_id,
        name: category.title,
      };
    });
    categories.forEach((category, index) => {
      params[`category_ids[${index}]`] = category.id;
    });
  } else {
    params["category_ids[0]"] = msgData.categoryId;
  }
  // User message alert
  const searchParams = new URLSearchParams(params);
  console.log(searchParams);
  const data = await fetch(
    `https://www.kairete.net/api/blog-entries?${searchParams}`,
    {
      method: "GET",
      headers: {
        "XF-Api-KEY": "Bj-iF2DqxqJcBEolg9H6Qjp94ekWVM1Y",
        "XF-API-USER": 1,
      },
    },
  );
  if (data.errors) return bot.sendMessage(msg.from.id, "Error category API");
  const dataJSON = await data.json();
  let sendData = dataJSON["blogEntryItems"].map((item) => {
    return {
      title: item?.title,
      thumbnail: item?.CoverImage?.thumbnail_url,
      content: item?.message_plain_text,
      url: item?.view_url,
    };
  });
  // send message to user multiple message combine each object in 1 message
  for await (const item of sendData) {
    try {
      const replyMarkup = bot.inlineKeyboard([
        [bot.inlineButton("Read more", { url: item.url })],
      ]);
      await bot.sendPhoto(msg.from.id, item.thumbnail, {
        caption: item.title,
      });
      await bot.sendMessage(
        msg.from.id,
        `${item.title}
  
  ${item.content.slice(0, 300)}`,
        {
          replyMarkup,
        },
      );
    } catch (error) {
      console.log(error);
    }
  }
  return bot.sendMessage("Done");
});

// Inline query
bot.on("inlineQuery", (msg) => {
  const query = msg.query;
  const answers = bot.answerList(msg.id);

  answers.addArticle({
    id: "query",
    title: "Inline Query",
    description: `Your query: ${query}`,
    message_text: "Click!",
  });

  return bot.answerQuery(answers);
});

bot.start({
  webhook: {
    host: '0.0.0.0',
    port: 3000,
    url: 'telegrambot-meepawn2019.koyeb.app/',
  }
});
