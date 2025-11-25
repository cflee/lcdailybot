# lcdailybot

This is a weekend hack, playing fast and loose with reviews and testing in production, so this is not at all supposed to look like production ready code.
No tests, janky AI-generated code, manual db migrations if any...

## Overview

This is structured as a Cloudflare Worker running some TypeScript code, listening for webhooks from the Telegram Bot API.

It is also regularly run with a [cron trigger](https://developers.cloudflare.com/workers/configuration/cron-triggers/), to update the storage (D1 database) and to send telegram messages out.

## Setup

Create a Cloudflare Worker.
Get the worker's domain on `workers.dev`.

Do the usual flow with `@BotFather` to create a bot.

Take the token and store it in `TELEGRAM_BOT_TOKEN`, as a [secret](https://developers.cloudflare.com/workers/configuration/secrets/) on the Cloudflare Worker, and as a line in your local `.dev.vars` file for running `wrangler dev` and for the types generation.

Generate a webhook secret and store it in `TELEGRAM_BOT_WEBHOOK_SECRET`, similar to the token above.
Ensure it fits within the Telegram Bot API's requirements, 1-256 characters and only `A-Za-z9-0_-` characters is allowed.

## Register worker's webhook with Telegram

Once the worker's webhook is deployed, manually call the [`setWebhook` Bot API method](https://core.telegram.org/bots/api#setwebhook) to register the webhook URL and webhook secret for the bot.

```bash
curl --request POST \
    --header "Content-Type: application/json" \
    --data '{"url":"https://abc.xyz.workers.dev/telegramWebhook","secret_token":"abcdef"}' \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook"
```

Check the bot's configured webhook.

```bash
curl --request GET \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

## Deploy

The secrets are provisioned directly on the Cloudflare dashboard.

Env vars might be from the wrangler config file?

Cron trigger is added and updated in `wrangler.jsonc`.
Only removal is done via the dashboard.

To deploy local code to Cloudflare:

```bash
pnpm run deploy
```
