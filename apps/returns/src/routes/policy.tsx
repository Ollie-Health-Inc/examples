import { useState } from "react";
import type { FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { EXAMPLE_POLICY, saveSettings, useSettings } from "#/lib/desk";

export const Route = createFileRoute("/policy")({ component: PolicyPage });

function PolicyPage() {
  const settings = useSettings();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-10">
      <section>
        <h1 className="text-5xl font-semibold">Return policy</h1>
        <p className="mt-4 text-lg text-neutral-500">
          Sent to the agent at the start of every new request. A request keeps
          the policy it started with, so edits only apply to new ones.
        </p>
      </section>

      {/* The policy is only saved in the browser, so wait until it's been read. */}
      {settings && <PolicyForm savedPolicy={settings.policy} />}
    </main>
  );
}

function PolicyForm({ savedPolicy }: { savedPolicy: string }) {
  const [policy, setPolicy] = useState(savedPolicy);
  const saved = policy === savedPolicy;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    saveSettings({ policy });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <textarea
        value={policy}
        onChange={(event) => setPolicy(event.target.value)}
        rows={10}
        placeholder="One rule per line"
        aria-label="Return policy"
        className="field font-mono text-sm"
      />
      <p className="text-sm text-neutral-500">
        Leave it empty to use the agent's built-in default: unopened items
        within 30 days are refundable, opened supplements and peptides aren't,
        and damaged, wrong or warm deliveries are replaced.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPolicy(EXAMPLE_POLICY)}
          className="chip"
        >
          Use an example
        </button>
        <span className="flex-1 text-right text-sm text-neutral-500">
          {saved ? "Saved" : "Not saved"}
        </span>
        <button type="submit" disabled={saved} className="button py-2">
          Save policy
        </button>
      </div>
    </form>
  );
}
