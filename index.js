const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
import TeleBot from "telebot";
import sqlite3 from "sqlite3";
import * as dotenv from "dotenv";
import { JsonDB, Config } from "node-json-db";
dotenv.config();
const TOKEN = "5422271134:AAFWZ53ojsZ2p8Ym7u-eLbplUB1zZbsrefs";
import cron from "node-cron";

var jsondb = new JsonDB(new Config("telegrambot", true, false, "/"));

const bot = new TeleBot(TOKEN);

import { open } from "sqlite";

const isAllPostFieldsFilled = async (telegram_id) => {
  try {
    const title = await jsondb.getData(`/${telegram_id}/title`);
    const description = await jsondb.getData(`/${telegram_id}/description`);
    const category_id = await jsondb.getData(`/${telegram_id}/category-id`);
    const blog_id = await jsondb.getData(`/${telegram_id}/blog-id`);
    console.log({ title, description, category_id, blog_id });
    return true;
  } catch (err) {
    return false;
  }
};

bot.on("text", async (msg) => {
  if (msg.reply_to_message && msg.reply_to_message.text === "Title:") {
    // add title to jsondb
    jsondb.push(`/${msg.from.id}/title`, msg.text);
  }
  if (msg.reply_to_message && msg.reply_to_message.text === "Description:") {
    // add description to jsondb
    jsondb.push(`/${msg.from.id}/description`, msg.text);
  }
  if (msg.reply_to_message && msg.reply_to_message.text === "Category ID:") {
    // add link to jsondb
    jsondb.push(`/${msg.from.id}/category-id`, msg.text);
  }
  if (msg.reply_to_message && msg.reply_to_message.text === "Blog ID:") {
    // add image to jsondb
    jsondb.push(`/${msg.from.id}/blog-id`, msg.text);
  }
  if ((await isAllPostFieldsFilled(msg.from.id)) && !msg.text.startsWith("/")) {
    const replyMarkup = bot.inlineKeyboard([
      [
        bot.inlineButton("Publish", {
          callback: JSON.stringify({ type: "post" }),
        }),
      ],
    ]);
    bot.sendMessage(msg.from.id, "Click to post blog", { replyMarkup });
  }
});

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
      "You are not logged in, please use /login username||password command to login",
      { parseMode: "HTML" }
    );
  }
  const replyMarkup = bot.inlineKeyboard([
    [
      bot.inlineButton("Get data", {
        callback: JSON.stringify({ type: "start", userId: user.user_id }),
      }),
    ],
  ]);

  // const listCommand = `<b>/start</b> - Start command to get you start.
  // <b>/categories</b> - List category of blog.
  // <b>/posts</b> - List posts of blog.
  // <b>/logout</b> - Logout command to de-active session.
  // <b>/help</b> - Type help to list all command`;
  // bot.sendMessage(msg.from.id, listCommand, { parseMode: "HTML" });

  db.close();
  bot.sendMessage(msg.from.id, "Welcome to Kairete Bot", { replyMarkup });
  return;
});

bot.on(["/help"], (msg) => {
  const listCommand = `<b>/start</b> - Start command to get you start.
  <b>/categories</b> - List category of blog.
  <b>/posts</b> - List posts of blog.
  <b>/logout</b> - Logout command to de-active session.
  <b>/help</b> - Type help to list all command`;
  return bot.sendMessage(msg.from.id, listCommand, { parseMode: "HTML" });
});

bot.on(["/posts"], async (msg) => {
  const db = await open({
    filename: "./login.db",
    driver: sqlite3.Database,
  });
  let user = null;
  try {
    user = await db.get("SELECT * FROM users WHERE telegram_id = ?", [
      msg.from.id,
    ]);
  } catch (err) {
    console.log(err);
  }
  if (!user) {
    return bot.sendMessage(
      msg.from.id,
      "You are not logged in, please use /login username||password command to login",
      { parseMode: "HTML" }
    );
  }
  const replyMarkup = bot.inlineKeyboard([
    [
      bot.inlineButton("Post", {
        callback: JSON.stringify({ type: "post", userId: user.user_id }),
      }),
    ],
    [
      bot.inlineButton("Title", {
        callback: JSON.stringify({ type: "blog-title", userId: user.user_id }),
      }),
      bot.inlineButton("Message", {
        callback: JSON.stringify({
          type: "blog-description",
          userId: user.user_id,
        }),
      }),
    ],
    [
      bot.inlineButton("Category ID", {
        callback: JSON.stringify({
          type: "blog-category",
          userId: user.user_id,
        }),
      }),
      bot.inlineButton("Blog ID", {
        callback: JSON.stringify({ type: "blog-id", userId: user.user_id }),
      }),
    ],
  ]);
  return bot.sendMessage(msg.from.id, "Create your blog entry", {
    replyMarkup,
  });
});

bot.on(["/logout"], async (msg) => {
  await bot.sendMessage(msg.from.id, "Logging out...");
  const db = await open({
    filename: "./login.db",
    driver: sqlite3.Database,
  });
  const query = `DELETE FROM users WHERE telegram_id = ${msg.from.id}`;
  await db.run(query);
  await db.close();
  return bot.sendMessage(msg.from.id, "Logged out");
});

bot.on(["/categories"], async (msg) => {
  const db = await open({
    filename: "./login.db",
    driver: sqlite3.Database,
  });
  const user = await db.get("SELECT * FROM users WHERE telegram_id = ?", [
    msg.from.id,
  ]);
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
    [
      bot.inlineButton("All", {
        callback: { categoriId: -1, userId: user.user_id },
      }),
    ],
  ]);
  db.close();
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
    [dataJSON.user.user_id, msg.from.id]
  );
  if (user) {
    await db.close();
    bot.sendMessage(
      msg.from.id,
      `Welcome ${username}!, your tele_id is ${msg.from.id}}`
    );
  } else {
    await db.run("INSERT INTO users (user_id, telegram_id) VALUES (?, ?)", [
      dataJSON.user.user_id,
      msg.from.id,
    ]);
    await db.close();
    bot.sendMessage(
      msg.from.id,
      `Welcome ${username}!, your tele_id is ${msg.from.id}`
    );
  }
  const params = new URLSearchParams();
  params.append("category_ids[0]", 2);
  params.append("category_ids[1]", 3);
  params.append("category_ids[2]", 5);
  const dataEntry = await fetch(
    `https://kairete.net/api/blog-entries?${params}`,
    {
      method: "GET",
      headers: {
        "XF-Api-Key": "Bj-iF2DqxqJcBEolg9H6Qjp94ekWVM1Y",
        "XF-Api-User": dataJSON.user.user_id,
      },
    }
  );
  const dataEntryJSON = await dataEntry.json();
  let sendData = dataEntryJSON["blogEntryItems"].slice(0, 10).map((item) => {
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
        }
      );
    } catch (error) {
      console.log(error);
    }
  }
  return;
});

bot.on("callbackQuery", async (msg) => {
  const msgData = JSON.parse(msg.data);
  if (msgData.type === "blog-title") {
    return bot.sendMessage(msg.from.id, "Title:", {
      replyMarkup: { force_reply: true },
    });
  }
  if (msgData.type === "blog-description") {
    return bot.sendMessage(msg.from.id, "Description:", {
      replyMarkup: { force_reply: true },
    });
  }
  if (msgData.type === "blog-category") {
    return bot.sendMessage(msg.from.id, "Category ID:", {
      replyMarkup: { force_reply: true },
    });
  }
  if (msgData.type === "blog-id") {
    return bot.sendMessage(msg.from.id, "Blog ID:", {
      replyMarkup: { force_reply: true },
    });
  }
  if (msgData.type === "post") {
    const user_telegram_id = msg.from.id;
    // get data from jsondb
    const title = await jsondb.getData(`/${user_telegram_id}/title`);
    const description = await jsondb.getData(
      `/${user_telegram_id}/description`
    );
    const category_id = await jsondb.getData(
      `/${user_telegram_id}/category-id`
    );
    const blog_id = await jsondb.getData(`/${user_telegram_id}/blog-id`);
    const formData = new URLSearchParams();
    formData.append("title", title);
    formData.append("message", description);
    formData.append("category_id", category_id);
    formData.append("blog_id", blog_id);
    formData.append("user_id", 1);
    try {
      const request = await fetch("https://www.kairete.net/api/blog-entries", {
        method: "POST",
        headers: {
          "XF-Api-Key": "Bj-iF2DqxqJcBEolg9H6Qjp94ekWVM1Y",
          "XF-Api-User": 1,
        },
        body: formData,
      });
      const requestJSON = await request.json();
      if (requestJSON.errors) {
        return bot.sendMessage(msg.from.id, requestJSON.errors[0].message);
      }
      await jsondb.delete(`/${user_telegram_id}`);
      return bot.sendMessage(msg.from.id, "Posted!");
    } catch (err) {
      console.log(err);
      return bot.sendMessage(
        msg.from.id,
        "Error posting blog, Please check your content"
      );
    }
  }
  if (msgData.type === "start") {
    const params = new URLSearchParams();
    params.append("category_ids[0]", 2);
    params.append("category_ids[1]", 3);
    params.append("category_ids[2]", 5);
    const data = await fetch(`https://kairete.net/api/blog-entries?${params}`, {
      method: "GET",
      headers: {
        "XF-Api-Key": "Bj-iF2DqxqJcBEolg9H6Qjp94ekWVM1Y",
        "XF-Api-User": msgData.userId,
      },
    });
    const dataJSON = await data.json();
    let sendData = dataJSON["blogEntryItems"].slice(0, 10).map((item) => {
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
          }
        );
      } catch (error) {
        console.log(error);
      }
    }
  }
  let params = {};
  if (msgData.categoryId !== -1) {
    // get all category
    params["category_ids[0]"] = msgData.categoryId;
  }
  // User message alert
  const searchParams = new URLSearchParams(params);
  const data = await fetch(
    `https://www.kairete.net/api/blog-entries?${searchParams}`,
    {
      method: "GET",
      headers: {
        "XF-Api-KEY": "Bj-iF2DqxqJcBEolg9H6Qjp94ekWVM1Y",
        "XF-API-USER": 1,
      },
    }
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
        }
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

const botCron = async () => {
  console.log("Bot cron running");
  // get all users from db
  const db = await open({
    filename: "./login.db",
    driver: sqlite3.Database,
  });
  const users = await db.all("SELECT * FROM users");
  console.log(users);
  // send message to all users
  const params = new URLSearchParams();
  params.append("category_ids[0]", 2);
  params.append("category_ids[1]", 3);
  params.append("category_ids[2]", 5);
  // send message to user multiple message combine each object in 1 message
  users.forEach(async (user) => {
    const data = await fetch(`https://kairete.net/api/blog-entries?${params}`, {
      method: "GET",
      headers: {
        "XF-Api-Key": "Bj-iF2DqxqJcBEolg9H6Qjp94ekWVM1Y",
        "XF-Api-User": user.user_id,
      },
    });
    const dataJSON = await data.json();
    let sendData = dataJSON["blogEntryItems"].slice(0, 10).map((item) => {
      return {
        title: item?.title,
        thumbnail: item?.CoverImage?.thumbnail_url,
        content: item?.message_plain_text,
        url: item?.view_url,
      };
    });
    for await (const item of sendData) {
      try {
        const replyMarkup = bot.inlineKeyboard([
          [bot.inlineButton("Read more", { url: item.url })],
        ]);
        await bot.sendPhoto(user.telegram_id, item.thumbnail, {
          caption: item.title,
        });
        await bot.sendMessage(
          user.telegram_id,
          `${item.title}

      ${item.content.slice(0, 300)}`,
          {
            replyMarkup,
          }
        );
      } catch (error) {
        console.log(error);
      }
    }
  });
  return;
};
// run every 6am everyday Italy time
cron.schedule("0 11 * * *", botCron, {
  scheduled: true,
  timezone: "Europe/Rome",
});

bot.start();
