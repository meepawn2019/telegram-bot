const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
var FormData = require("form-data");
var request = require("request");
const TeleBot = require("telebot");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const db = new sqlite3.Database("./login.db");

let sql = `SELECT DISTINCT Name name FROM playlists
           ORDER BY name`;

const bot = new TeleBot(TOKEN);

const timeout = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const MOCKING_DATABASE = [
  {
    username: "admin",
    password: "admin",
    tele_id: "869251272",
    some_info: "some info",
  },
  {
    username: "Demo",
    password: "DemoKairete2022@",
    tele_id: "869251272",
    some_info: "some info",
  },
];

bot.on(["/login"], async (msg) => {
  const loginCredentials = msg.text.split(" ")[1].split("||");
  const username = loginCredentials[0];
  const password = loginCredentials[1];
  // fake time consuming task
  bot.sendMessage(msg.from.id, "Checking your credentials...");
  const formData = new FormData();
  formData.append("login", username);
  formData.append("password", password);
  var options = {
    method: "POST",
    url: "https://www.kairete.net/api/auth",
    headers: {
      "XF-Api-Key": "Bj-iF2DqxqJcBEolg9H6Qjp94ekWVM1Y",
    },
    formData: {
      login: username,
      password: password,
    },
  };
  request(options, function (error, response) {
    if (error) {
      return bot.sendMessage(msg.from.id, "Login failed!, please try again");
    }
    let user;
    const obj = JSON.parse(response.body);
    console.log(obj);
    if (obj.errors) return bot.sendMessage(msg.from.id, "Login failed!, please try again");
    // find user in sqlite database
    db.all(
      "SELECT * FROM users WHERE telegram_id = ?",
      [msg.from.id],
      (err, rows) => {
        if (err) {
          console.log(err);
          return bot.sendMessage(
            msg.from.id,
            "DB failed, cannot select user from database",
          );
        }
        rows.forEach((row) => {
          user = row;
        });
        console.log(rows);
        // if user is not found in sqlite database
        if (!user) {
          // create new user in sqlite database
          db.run(
            "INSERT INTO users(telegram_id, user_id) VALUES(?, ?)",
            [msg.from.id, obj.user.user_id],
            function (err) {
              if (err) {
                return bot.sendMessage(
                  msg.from.id,
                  "DB failed, Not marked as logged in",
                );
              }
              let replyMarkup = bot.inlineKeyboard([
                [bot.inlineButton("Get data", { callback: obj.user.user_id })],
              ]);
              console.log(user);
              console.log(`A row has been inserted with rowid ${this.lastID}`);
              return bot.sendMessage(
                msg.from.id,
                `Welcome ${username}!, your tele_id is ${msg.from.id}}`,
                { replyMarkup },
              );
            },
          );
        } else {
          const params = {
            creator_id: obj.user.user_id,
          };
          const searchParams = new URLSearchParams(params);
          var options = {
            method: "GET",
            url: "https://www.kairete.net/api/blog-entries?" + searchParams,
            headers: {
              "XF-Api-Key": "Bj-iF2DqxqJcBEolg9H6Qjp94ekWVM1Y",
            },
          };
          request(options, function (error, response) {
            if (error) {
              bot.sendMessage(msg.from.id, "Error");
            }
            console.log(response.body);
            return bot.sendMessage(msg.from.id, response.body);
          });        
        }
      },
    );
  });
});

bot.on("callbackQuery", (msg) => {
  console.log(msg.data);
  // User message alert
  const params = {
    creator_id: msg.data,
  };
  const searchParams = new URLSearchParams(params);
  var options = {
    method: "GET",
    url: "https://www.kairete.net/api/blog-entries?" + searchParams,
    headers: {
      "XF-Api-Key": "Bj-iF2DqxqJcBEolg9H6Qjp94ekWVM1Y",
    },
  };
  request(options, function (error, response) {
    if (error) {
      bot.sendMessage(msg.from.id, "Error");
    }
    console.log(response.body);
    return bot.sendMessage(msg.from.id, response.body);
  });
  // bot.sendMessage(msg.from.id, `Callback data: ${ msg.data }`);
  // return bot.answerCallbackQuery(msg.id, `Inline button callback: ${ msg.data }`, true);
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

bot.start();
