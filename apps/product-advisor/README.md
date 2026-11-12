# Product advisor

A small [TanStack Start](https://tanstack.com/start) app for testing the Loops **Product advisor agent**. The home page lists the organization's shoppers from Loops and lets you add new ones. Opening a shopper shows their saved quiz and lets you chat with the agent as them.

## Run it

1. Run Loops locally (the API listens on `http://localhost:8787`), sign in to the dashboard, and deploy the **Product advisor agent** template.
2. Copy the organization id and the `product-advisor` loop id from the loop's page.
3. In **Settings → API tokens**, create a token for that loop with access set to **Run and read**.
4. Copy `.env.example` to `.env` and fill in those values.
5. From the repository root, run `bun install` and then `bun run dev`.

Restart the dev server after changing `.env`.

## How it works

| File                           | What it does                                                 |
| ------------------------------ | ------------------------------------------------------------ |
| `src/lib/loops.ts`             | Server functions for the three Loops endpoints the app uses. |
| `src/lib/shoppers.ts`          | What Loops doesn't store: names, thread ids and transcripts. |
| `src/routes/index.tsx`         | The shopper list.                                            |
| `src/routes/users.$userId.tsx` | A shopper's last quiz and the chat.                          |

### Keeping the token on the server

The API token can run and read your organization's loops, so it must never reach the browser. Every call to Loops lives in a `createServerFn` in `src/lib/loops.ts`. The browser calls the server function, and only the server talks to Loops.

### The three endpoints

| Endpoint              | Used for                                           |
| --------------------- | -------------------------------------------------- |
| `GET /users`          | The shopper list, 50 at a time with **Load more**. |
| `GET /users/{userId}` | A shopper's saved quiz. `404` means no quiz yet.   |
| `POST /chat`          | Sending one message and getting the reply.         |

All three paths start with `/loop/{organizationId}/{loopId}`.

### Draft shoppers

Loops has no endpoint for creating users. A user only appears in Loops once the agent saves their first quiz. So when you create a shopper, the app keeps them in the browser as a draft, marked **No quiz yet**. Once their id shows up in `GET /users`, the list shows the Loops row instead.

Loops only stores the id, so names stay in the browser too, keyed by id. Users created by other apps show their id instead.

### Threads

A `threadId` is one conversation. Loops remembers everything said in a thread, so the app sends only the new message, never the history. Each shopper has a random thread id, and **New conversation** swaps it for a fresh one.

Loops has no endpoint for reading a thread's past messages, so the app keeps its own copy of the transcript to show after a reload.

### Telling the agent who it's talking to

The chat API has no user field. So that the agent saves its recommendations to the right person, the first message of every thread starts with an intro line:

```
Hi, I'm Thandi. My email is thandi@example.com.

I want something to help me sleep better
```

### Seeing the saved quiz

After the agent recommends, it saves the quiz in a separate workflow that finishes a few seconds later. So after each reply, the shopper page checks `GET /users/{userId}` every 3 seconds for up to 30 seconds, and refreshes the **Last quiz** panel once `completedAt` changes.

### Errors

A failed chat turn is removed, put back in the input, and the error is shown. Resending on the same thread is safe. If loading the list or a shopper fails, for example because of a bad token, the page shows the error instead.

## Try it

1. Create a shopper. They show as **No quiz yet**, and their page has no quiz.
2. Chat as them until the agent recommends something. Within about 30 seconds the **Last quiz** panel fills in, and back on the list they're now a Loops row.
3. Chat as a second shopper. The two conversations never mix.
4. Click **New conversation**. The agent starts fresh, and the earlier quiz stays in the panel.
5. Put a wrong token in `.env` and restart. The list shows the `401` error.
