import { useState } from "react";
import type { FormEvent } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { savePatient, usePatients } from "#/lib/patients";

export const Route = createFileRoute("/")({ component: StartPage });

function StartPage() {
  const patients = usePatients();

  return (
    <main className="mx-auto w-full max-w-xl space-y-10">
      <section>
        <h1 className="text-5xl font-semibold">Book a visit.</h1>
        <p className="mt-4 text-lg text-neutral-500">
          Tell us a little about yourself, then answer a few questions about why
          you'd like to be seen. The clinic will contact you to confirm a time.
        </p>
      </section>

      <PatientForm />

      {patients && patients.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Continue an intake</h2>
          <ul className="space-y-2">
            {patients.map((patient) => (
              <li key={patient.id}>
                <Link
                  to="/intake/$patientId"
                  params={{ patientId: patient.id }}
                  className="card flex items-center justify-between p-4 hover:border-neutral-300"
                >
                  <span>
                    <span className="font-medium">{patient.name}</span>{" "}
                    <span className="text-sm text-neutral-500">
                      {patient.id}
                    </span>
                  </span>
                  <span className="text-sm text-neutral-500">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function PatientForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [area, setArea] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const id = email.trim().toLowerCase();
    savePatient(name.trim(), id, area.trim());
    navigate({ to: "/intake/$patientId", params: { patientId: id } });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <input
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Your name"
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
        value={area}
        onChange={(event) => setArea(event.target.value)}
        placeholder="Suburb and city (optional)"
        className="input shadow-none"
      />
      <p className="px-2 text-sm text-neutral-500">
        Your area helps us point you to the nearest hospital if anything sounds
        urgent.
      </p>
      <button type="submit" className="button w-full">
        Start intake
      </button>
    </form>
  );
}
