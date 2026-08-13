import { useState } from "react";

import {
  login,
  register
} from "../services/api.js";

function Login({
  onLogin
}) {
  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [registerMode, setRegisterMode] =
    useState(false);

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const submit =
    async (event) => {
      event.preventDefault();

      if (loading) {
        return;
      }

      setError("");

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      if (!normalizedEmail) {
        setError(
          "Email is required."
        );
        return;
      }

      if (password.length < 6) {
        setError(
          "Password must be at least 6 characters."
        );
        return;
      }

      setLoading(true);

      try {
        const response =
          registerMode
            ? await register(
                normalizedEmail,
                password
              )
            : await login(
                normalizedEmail,
                password
              );

        if (
          !response?.token ||
          !response?.user
        ) {
          throw new Error(
            "Invalid response from server."
          );
        }

        onLogin(
          response.user,
          response.token
        );
      } catch (error) {
        setError(
          error.message ||
            "Something went wrong."
        );
      } finally {
        setLoading(false);
      }
    };

  const toggleMode =
    () => {
      if (loading) {
        return;
      }

      setRegisterMode(
        (current) => !current
      );

      setError("");
    };

  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </div>

          <span className="font-bold text-slate-900 tracking-tight">
            URL KeepAlive
          </span>
        </div>

        <form
          onSubmit={submit}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8"
        >
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            {registerMode
              ? "Create account"
              : "Welcome back"}
          </h1>

          <p className="text-sm text-slate-500 mb-6">
            {registerMode
              ? "Start monitoring your services."
              : "Sign in to manage your URLs."}
          </p>

          {error && (
            <div
              role="alert"
              className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-5"
            >
              {error}
            </div>
          )}

          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              placeholder="Email address"
              autoComplete="email"
              required
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
            />

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              placeholder="Password (min 6 characters)"
              autoComplete={
                registerMode
                  ? "new-password"
                  : "current-password"
              }
              minLength={6}
              required
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {loading
              ? "Please wait…"
              : registerMode
                ? "Create account"
                : "Sign in"}
          </button>

          <button
            type="button"
            onClick={
              toggleMode
            }
            disabled={loading}
            className="w-full mt-3 py-2 text-sm text-slate-400 hover:text-slate-700 disabled:opacity-50"
          >
            {registerMode
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default Login;