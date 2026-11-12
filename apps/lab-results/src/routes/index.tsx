import { useState } from "react";
import type { FormEvent } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { savePatient, usePatients } from "#/lib/patients";

export const Route = createFileRoute("/")({ component: PatientsPage });

function PatientsPage() {
  const patients = usePatients();

  return (
    <main className="mx-auto w-full max-w-xl space-y-10">
      <section>
        <h1 className="text-5xl font-semibold">Your results, explained.</h1>
        <p className="mt-4 text-lg text-neutral-500">
          A mock patient portal. Add a test patient, pick a set of sample
          results, and ask the agent what they mean.
        </p>
      </section>

      <PatientForm />

      {patients && patients.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Test patients</h2>
          <ul className="space-y-2">
            {patients.map((patient) => (
              <li key={patient.id}>
                <Link
                  to="/patients/$patientId"
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

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const id = email.trim().toLowerCase();
    savePatient(name.trim(), id);
    navigate({ to: "/patients/$patientId", params: { patientId: id } });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
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
      <p className="px-2 text-sm text-neutral-500">
        The email is the patient's id in Loops. The agent's tool expects an
        email or phone number, so it may not pass on any other kind of id.
      </p>
      <button type="submit" className="button w-full">
        Open patient
      </button>
    </form>
  );
}
