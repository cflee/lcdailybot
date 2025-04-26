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
import { daily, todayUtcDate, leetcodeApiDaily, leetcodeApiRecentAcSubmissions } from "./leetcode";

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
		console.log("Scheduled task starting");
		const DB = env.DB;
		const botToken = env.TELEGRAM_BOT_TOKEN;
		const today = todayUtcDate();

		console.log(`Today's date: ${today}`);
		let dailyQuestion = await db.getDailyQuestion(DB, today);
		if (!dailyQuestion) {
			const apiDaily = await leetcodeApiDaily();
			await db.insertDailyQuestion(DB, apiDaily);
			dailyQuestion = apiDaily;
		}
		console.log(`Today's question: ${dailyQuestion.questionTitle}`)

		const allUsernames = await db.getAllLeetcodeUsernames(DB);

		console.log(`Total LeetCode usernames: ${allUsernames.length}`);
		for (const username of allUsernames) {
			const completion = await db.getCompletionStatus(DB, today, username);
			if (completion === null || !completion) {
				try {
					const recents = await leetcodeApiRecentAcSubmissions(username, 20);
					const solved = recents.some((s) => s.titleSlug === dailyQuestion.questionTitleSlug);
					await db.setCompletionStatus(DB, today, username, solved);
				} catch (err) {
					console.error(`Failed to get submissions for ${username}:`, err);
				}
			}
			console.log(`Completion status for ${username}: ${completion ? "solved" : "not solved"}`);
		}
		console.log("Completed processing LeetCode usernames");

		const allChats = await db.getAllChats(DB);
		for (const chatId of allChats) {
			console.log(`Processing chat: ${chatId}`);
			const usernames = await db.getLeetcodeUsernamesForChat(DB, chatId);
			const statusList = [];
			for (const username of usernames) {
				const completed = await db.getCompletionStatus(DB, today, username);
				statusList.push({ username, completed: !!completed });
			}
			const red = statusList.filter((u) => !u.completed).sort((a, b) => a.username.localeCompare(b.username));
			const green = statusList.filter((u) => u.completed).sort((a, b) => a.username.localeCompare(b.username));
			const emojiLine = `${"🔴".repeat(red.length)}${"🟢".repeat(green.length)}`;
			let msg = `${emojiLine}
<b>Daily Challenge for ${today}</b>
<a href="${dailyQuestion.url}">${dailyQuestion.questionTitle}</a> (${dailyQuestion.questionDifficulty})`;
			for (const u of red) {
				msg += `\n🔴 ${u.username}`;
			}
			for (const u of green) {
				msg += `\n🟢 ${u.username}`;
			}

			const previouslySentMsg = await db.getDailyMessageSent(DB, today, chatId);
			const bot = new Bot(botToken);
			if (previouslySentMsg) {
				// Do not try to edit message if the text is the same, as the editMessageText API will throw an error
				if (msg === previouslySentMsg.message_text) {
					console.log(`Message for chat ${chatId} is the same, skipping update`);
				} else {
					try {
						await bot.api.editMessageText(chatId, Number(previouslySentMsg.message_id), msg, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
					} catch (e) {
						console.error("Failed to update message:", e);
					}
				}
			} else {
				// New message: unpin previous if any, then send and pin new
				const prevDayMsg = await db.getLastDailyMessageSent(DB, chatId, today);
				if (prevDayMsg) {
					try {
						await bot.api.unpinChatMessage(chatId, prevDayMsg.message_id);
					} catch (e) {
						console.log("Unpin previous message failed (but it might not be an error if somebody else unpinned it):", e);
					}
				}
				try {
					const sent = await bot.api.sendMessage(chatId, msg, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
					if (sent?.message_id) {
						await db.setDailyMessageSent(DB, today, chatId, sent.message_id, msg);
						try {
							await bot.api.pinChatMessage(chatId, sent.message_id, { disable_notification: true });
						} catch (e) {
							console.error("Failed to pin message:", e);
						}
					} else {
						console.error("Failed to send message but didn't get an exception");
					}
				} catch (e) {
					console.error("Failed to send message:", e);
				}
			}
			console.log(`Processed chat: ${chatId}`);
		}
	},
} satisfies ExportedHandler<Env>;
