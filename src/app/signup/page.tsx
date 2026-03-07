"use client";

import { FormEvent, useState } from "react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState<string>("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setResult("Submitting...");

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email }),
    });

    const data = await res.json();
    if (!res.ok) {
      setResult(data.error ?? "Signup failed");
      return;
    }

    setResult("Signup received. You can now be routed to subscriptions and reports access flow.");
    setName("");
    setEmail("");
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">Create account</h1>
      <p className="mt-2 text-sm text-zinc-600">Sign up to access reports and subscription offerings.</p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <input className="w-full rounded border p-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="w-full rounded border p-2" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <button className="rounded bg-black px-4 py-2 text-white" type="submit">Sign up</button>
      </form>

      {result ? <p className="mt-4 text-sm">{result}</p> : null}
    </main>
  );
}
