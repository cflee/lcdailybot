/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Bot, webhookCallback } from "grammy";
import * as db from "./db";
import { daily } from "./leetcode";

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method === "POST") {
			const url = new URL(request.url);
			if (url.pathname !== "/telegramWebhook") {
				return new Response("Not Found", { status: 404 });
			}

			const bot = new Bot(env.TELEGRAM_BOT_TOKEN, {
				botInfo: JSON.parse(env.TELEGRAM_BOT_INFO),
			});
			bot.command("start", (ctx) => {
				console.log(`Received start command from chat: ${ctx.chat.id}`);
				return ctx.reply("Hello world", {
					reply_parameters: {
						message_id: ctx.msg.message_id,
					},
				});
			});
			bot.command("subscribe", async (ctx) => {
				const chatId = ctx.chat.id;
				if (await db.checkSubscriber(env.DB, chatId)) {
					await ctx.reply("This chat was already subscribed!", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
					return;
				}
				const ok = await db.insertSubscriber(env.DB, chatId);
				if (ok) {
					await ctx.reply("This chat is now subscribed!", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
				} else {
					await ctx.reply("There was a problem subscribing this chat.", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
				}
			});

			bot.command("unsubscribe", async (ctx) => {
				const chatId = ctx.chat.id;
				if (!(await db.checkSubscriber(env.DB, chatId))) {
					await ctx.reply("This chat was already not subscribed!", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
					return;
				}
				const ok = await db.deleteSubscriber(env.DB, chatId);
				if (ok) {
					await ctx.reply("This chat is now unsubscribed!", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
				} else {
					await ctx.reply("There was a problem unsubscribing this chat.", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
				}
			});
			bot.command("daily", async (ctx) => {
				console.log(`Received daily command from chat: ${ctx.chat.id}`);
				const curDaily = await daily(env.DB);
				console.log(curDaily);
				const message = `<b>Daily Challenge for ${curDaily.date}</b>
<a href="${curDaily.url}">${curDaily.questionTitle}</a> (${curDaily.questionDifficulty})`;
				await ctx.reply(message, {
					parse_mode: "HTML",
				});
			});

			bot.command("add_leetcode", async (ctx) => {
				const chatId = ctx.chat.id;
				const args = ctx.match?.trim();
				if (!args) {
					await ctx.reply("Usage: /add_leetcode <leetcode_username>", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
					return;
				}
				if (!(await db.checkSubscriber(env.DB, chatId))) {
					await ctx.reply("This chat must subscribe first.", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
					return;
				}
				const username = args.split(/\s+/)[0];
				const ok = await db.addLeetcodeUsername(env.DB, chatId, username);
				if (ok) {
					await ctx.reply(`Added LeetCode username: ${username}`, {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
				} else {
					await ctx.reply("Failed to add LeetCode username.", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
				}
			});

			bot.command("remove_leetcode", async (ctx) => {
				const chatId = ctx.chat.id;
				const args = ctx.match?.trim();
				if (!args) {
					await ctx.reply("Usage: /remove_leetcode <leetcode_username>", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
					return;
				}
				if (!(await db.checkSubscriber(env.DB, chatId))) {
					await ctx.reply("This chat must subscribe first.", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
					return;
				}
				const username = args.split(/\s+/)[0];
				const ok = await db.removeLeetcodeUsername(env.DB, chatId, username);
				if (ok) {
					await ctx.reply(`Removed LeetCode username: ${username}`, {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
				} else {
					await ctx.reply("Failed to remove LeetCode username.", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
				}
			});

			return webhookCallback(bot, "cloudflare-mod", {
				secretToken: env.TELEGRAM_BOT_WEBHOOK_SECRET,
			})(request);
		}
		return new Response("Not Found", { status: 404 });
	},
	async scheduled(controller, env, ctx) {
		console.log("schedule task starting");
	},
} satisfies ExportedHandler<Env>;
