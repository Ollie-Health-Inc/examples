import { useState } from "react";
import type { FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { saveOrderedCustomer } from "#/lib/customers";
import { placeOrder } from "#/lib/loops";
import { PRODUCTS, newOrderId } from "#/lib/products";

export const Route = createFileRoute("/")({ component: StorePage });

function StorePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [orderId, setOrderId] = useState(newOrderId);
  const [products, setProducts] = useState<string[]>([PRODUCTS[0]]);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  function toggle(product: string) {
    setProducts((picked) =>
      picked.includes(product)
        ? picked.filter((p) => p !== product)
        : [...picked, product],
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const customerId = email.trim().toLowerCase();
    setPlacing(true);
    setError("");

    try {
      await placeOrder({
        data: {
          customerId,
          products,
          orderId,
          // Without a phone, the workflow skips the SMS.
          ...(phone.trim() && { phone: phone.trim() }),
        },
      });
      saveOrderedCustomer(name.trim(), customerId);
      navigate({
        to: "/customers/$customerId",
        params: { customerId },
        search: { order: orderId },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPlacing(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl space-y-10">
      <section>
        <h1 className="text-5xl font-semibold">Place an order.</h1>
        <p className="mt-4 text-lg text-neutral-500">
          A mock store. Order for a test customer, then open them to see what
          Loops recorded and chat with the agent about their routine.
        </p>
      </section>

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div className="space-y-3">
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            className="input shadow-none"
          />
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="input shadow-none"
          />
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Phone (optional)"
            className="input shadow-none"
          />
          <p className="px-2 text-sm text-neutral-500">
            With a phone, Loops sends a real welcome SMS. Use your own number,
            or leave it blank.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 font-semibold">Products</legend>
          <div className="flex flex-wrap gap-2">
            {PRODUCTS.map((product) => {
              const picked = products.includes(product);
              return (
                <button
                  key={product}
                  type="button"
                  onClick={() => toggle(product)}
                  aria-pressed={picked}
                  className={`rounded-full px-4 py-2 text-sm ${
                    picked
                      ? "bg-brand text-white"
                      : "bg-neutral-200/60 text-neutral-800 hover:bg-neutral-200"
                  }`}
                >
                  {product}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="flex items-center gap-3 text-sm">
          <span className="text-neutral-500">Order reference</span>
          <input
            required
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            className="field w-32"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={placing || products.length === 0}
          className="button w-full"
        >
          {placing ? "Placing order…" : "Place order"}
        </button>
      </form>
    </main>
  );
}
