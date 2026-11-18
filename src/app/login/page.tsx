"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
      else {
        router.push("/");
        router.refresh();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName }, emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) setMsg(error.message);
      else if (data.session) {
        router.push("/");
        router.refresh();
      } else setMsg("Check your email to confirm your account, then sign in.");
    }
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center gap-3 pb-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo" className="h-20 w-20 object-contain" />
          <div>
            <h1 className="text-lg font-semibold text-brand">Business System Builder</h1>
            <p className="text-sm text-gray-500">{mode === "signin" ? "Sign in to continue" : "Create a staff account"}</p>
          </div>
        </div>
        {mode === "signup" && (
          <div>
            <label className="label">Full name</label>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
        )}
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {msg && <p className="text-sm text-red-700">{msg}</p>}
        <button className="btn w-full" disabled={busy}>
          {busy ? <><span className="spinner" />Please wait…</> : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <button type="button" className="w-full text-sm text-blue-800" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "New team member? Create an account" : "Already have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}
