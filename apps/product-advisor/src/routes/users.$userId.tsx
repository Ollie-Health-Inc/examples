import { useState } from "react";
import type { FormEvent } from "react";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import Markdown from "react-markdown";

import { getUser, sendChatMessage } from "#/lib/loops";
import type { LoopsUserDetails } from "#/lib/loops";
import {
  ensureShopper,
  introLine,
  newThreadId,
  updateShopper,
  useShoppers,
} from "#/lib/shoppers";
import type { Message, Shopper } from "#/lib/shoppers";

export const Route = createFileRoute("/users/$userId")({
  loader: ({ params }) => getUser({ data: params.userId }),
  component: ShopperPage,
});

const STARTERS = [
  "I want something to help me sleep better",
  "What should I take for more energy in the afternoons?",
  "I train five days a week, where do I start?",
];

function ShopperPage() {
  const { userId } = Route.useParams();
  const user = Route.useLoaderData();
  const shoppers = useShoppers();
  const router = useRouter();

  if (!shoppers) return null;

  const shopper = shoppers.find((s) => s.id === userId);
  if (!user && !shopper) {
    return (
      <p className="card">
        Shopper not found.{" "}
        <Link to="/" className="font-medium underline">
          Back to shoppers
        </Link>
      </p>
    );
  }

  // The save workflow finishes a few seconds after the agent replies, so check back for up to 30 seconds.
  async function watchForSavedQuiz() {
    const before = user?.metadata.quiz?.completedAt;
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const latest = await getUser({ data: userId });
      if (latest?.metadata.quiz?.completedAt !== before) {
        await router.invalidate();
        return;
      }
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-4">
      <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Shoppers
      </Link>
      <QuizPanel user={user} />
      <Chat userId={userId} shopper={shopper} onReply={watchForSavedQuiz} />
    </main>
  );
}

function QuizPanel({ user }: { user: LoopsUserDetails | null }) {
  const quiz = user?.metadata.quiz;

  if (!quiz) {
    return (
      <div className="card text-sm text-neutral-500">
        <p className="font-semibold text-neutral-900">Last quiz</p>
        <p className="mt-1">
          No quiz yet. Chat through to a recommendation and it'll show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="card space-y-3 text-sm">
      <div className="flex items-baseline justify-between">
        <p className="font-semibold">Last quiz</p>
        {quiz.completedAt && (
          <p className="text-neutral-500">
            {new Date(quiz.completedAt).toLocaleString()}
          </p>
        )}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-neutral-500">Goals</dt>
        <dd>{quiz.goals?.join(", ") || "None"}</dd>
        <dt className="text-neutral-500">Lifestyle</dt>
        <dd>{quiz.lifestyle || "None"}</dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        {quiz.recommendations?.map((product) => (
          <span key={product} className="rounded-full bg-sand px-3 py-1">
            {product}
          </span>
        ))}
      </div>
    </div>
  );
}

function Chat(props: {
  userId: string;
  shopper: Shopper | undefined;
  onReply: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");

  const name = props.shopper?.name || props.userId;
  const messages = props.shopper?.messages ?? [];

  function addMessage(message: Message) {
    updateShopper(props.userId, (s) => ({
      ...s,
      messages: [...s.messages, message],
    }));
  }

  async function send(text: string) {
    const shopper = ensureShopper(props.userId);

    // Loops remembers the thread, so send only the new message. The first one carries the intro.
    const isFirstMessage = shopper.messages.length === 0;
    const message = isFirstMessage ? `${introLine(shopper)}\n\n${text}` : text;

    addMessage({ role: "shopper", text });
    setDraft("");
    setError("");
    setThinking(true);

    try {
      const reply = await sendChatMessage({
        data: { threadId: shopper.threadId, message },
      });
      addMessage({ role: "advisor", text: reply });
      props.onReply();
    } catch (err) {
      // Undo the failed turn so the shopper can resend it. Retrying on the same thread is safe.
      updateShopper(props.userId, (s) => ({
        ...s,
        messages: s.messages.slice(0, -1),
      }));
      setDraft(text);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setThinking(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (draft.trim()) send(draft.trim());
  }

  function startNewConversation() {
    updateShopper(props.userId, (s) => ({
      ...s,
      threadId: newThreadId(),
      messages: [],
    }));
    setError("");
  }

  const [firstStarter, ...otherStarters] = STARTERS;

  return (
    <div className="card flex flex-1 flex-col p-0">
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <span className="size-2 rounded-full bg-orange-500" />
          Advisor
        </p>
        <button
          onClick={startNewConversation}
          disabled={thinking || messages.length === 0}
          className="text-neutral-500 hover:text-neutral-900 disabled:opacity-40"
        >
          New conversation
        </button>
      </div>

      <div className="flex-1 space-y-3 p-5">
        {messages.length === 0 && (
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold">Hi {name}</h1>
            <p className="text-neutral-600">
              Tell me what you're hoping for and I'll ask a few quick questions,
              then point you to one to three products that fit.
            </p>
            <button
              onClick={() => send(firstStarter)}
              disabled={thinking}
              className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              {firstStarter} →
            </button>
            <div className="flex flex-wrap gap-2">
              {otherStarters.map((starter) => (
                <button
                  key={starter}
                  onClick={() => send(starter)}
                  disabled={thinking}
                  className="chip"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <ChatBubble key={index} message={message} />
        ))}

        {thinking && <TypingIndicator />}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 flex gap-2 rounded-b-2xl bg-white p-4"
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`Message the advisor as ${name}`}
          disabled={thinking}
          className="input"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={thinking || !draft.trim()}
          className="button size-12 px-0"
        >
          ↑
        </button>
      </form>
    </div>
  );
}

function ChatBubble({ message }: { message: Message }) {
  if (message.role === "shopper") {
    return (
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl bg-neutral-900 px-4 py-2.5 text-white">
        {message.text}
      </div>
    );
  }

  // Replies are markdown, so render them as such to keep product links clickable.
  return (
    <div className="markdown w-fit max-w-[85%] rounded-2xl bg-sand px-4 py-2.5">
      <Markdown
        components={{
          a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {message.text}
      </Markdown>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex w-fit gap-1 rounded-2xl bg-sand px-4 py-3.5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-bounce rounded-full bg-neutral-500"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}
