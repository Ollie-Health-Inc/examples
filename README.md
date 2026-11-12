# Ollie examples

Example apps built on Loops, Ollie's platform for agents and workflows. Each one shows how an app outside Loops can talk to a Loops template through its HTTP API, with the API token kept on the server.

## Apps

| App                                     | What it shows                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [Product advisor](apps/product-advisor) | Chatting with the **Product advisor agent** as different shoppers, and reading back the quiz it saves on each user. |

Each app has its own README with setup steps and a walkthrough of how it works.

### Product advisor

A [TanStack Start](https://tanstack.com/start) microsite. Create shoppers, chat with the agent as them, and see the recommendations it saves to Loops.

[![The product advisor app](apps/product-advisor/screenshots/chat.png)](apps/product-advisor)

## Getting started

You need [Bun](https://bun.sh) 1.3 or later and Node.js 24 or later.

```sh
bun install
```

Each app needs its own Loops settings. Copy the app's `.env.example` to `.env` and fill it in, as described in that app's README. Then run every app in development mode:

```sh
bun run dev
```

Or run one app on its own:

```sh
bun run dev --filter=product-advisor
```

## Commands

Run these from the repository root. [Turborepo](https://turborepo.com) runs them in each app.

| Command               | What it does                    |
| --------------------- | ------------------------------- |
| `bun run dev`         | Starts the apps' dev servers.   |
| `bun run build`       | Builds the apps for production. |
| `bun run check-types` | Type-checks the apps.           |
| `bun run format`      | Formats the code with Prettier. |

## Adding an example

1. Create the app in `apps/<name>`. Bun picks it up as a workspace automatically.
2. Give it `dev`, `build` and `check-types` scripts so the root commands cover it.
3. Add a `.env.example` listing the settings it needs, and keep real values in `.env`, which is git-ignored.
4. Write a README with setup steps, how it works, and a screenshot or two, then add it to the table above.
