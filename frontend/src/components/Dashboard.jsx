import { useEffect, useState, useCallback } from "react";
import AddUrl from "./AddUrl";
import UrlCard from "./UrlCard";
import {
  getUrls,
  createUrl,
  updateUrl,
  deleteUrl
} from "../services/api.js";

function Dashboard({ user, onLogout, onUnauthorized }) {
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUrls = useCallback(async () => {
    try {
      setError("");
      const response = await getUrls();
      setUrls(response.urls);
    } catch (err) {
      if (err.status === 401) return onUnauthorized();
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUrls();
  }, [loadUrls]);

  const handleAdd = async (url, name) => {
    try {
      setError("");
      await createUrl(url, name);
      await loadUrls();
      return true;
    } catch (err) {
      if (err.status === 401) return onUnauthorized();
      setError(err.message);
      return false;
    }
  };

  const handleToggle = async (id, enabled) => {
    try {
      setError("");
      await updateUrl(id, { enabled });
      await loadUrls();
    } catch (err) {
      if (err.status === 401) return onUnauthorized();
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      setError("");
      await deleteUrl(id);
      await loadUrls();
    } catch (err) {
      if (err.status === 401) return onUnauthorized();
      setError(err.message);
    }
  };

  const totalCount = urls.length;
  const healthyCount = urls.filter((u) => u.lastStatus === "healthy").length;
  const failedCount = urls.filter((u) => u.lastStatus === "failed").length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Topbar ── */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <svg
              className="w-3.5 h-3.5 text-emerald-400"
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
          <span className="font-bold text-sm tracking-tight">URL KeepAlive</span>
        </div>

        <div className="flex items-center gap-5">
          <span className="text-slate-400 text-xs hidden sm:block">{user.email}</span>
          <button
            onClick={onLogout}
            className="text-xs text-slate-300 hover:text-white transition-colors font-medium"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">

        {/* Hero */}
        <section className="mb-10">
          <p className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-3">
            Automated URL Monitoring
          </p>
          <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 tracking-tight leading-none mb-4">
            Add once.
            <br />
            Run automatically.
          </h1>
          <p className="text-slate-500 max-w-xl leading-relaxed text-sm sm:text-base">
            Add your Render service URLs here. The built-in scheduler pings them
            every&nbsp;14&nbsp;minutes so they never sleep between requests.
          </p>
        </section>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: "Total", value: totalCount, color: "text-slate-900" },
            { label: "Healthy", value: healthyCount, color: "text-emerald-600" },
            { label: "Failed", value: failedCount, color: "text-red-500" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-white border border-slate-200 rounded-2xl px-4 py-4 text-center"
            >
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Add URL form */}
        <AddUrl onAdd={handleAdd} />

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">
            {error}
          </div>
        )}

        {/* URL list */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Your URLs</h2>
            <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
              {totalCount} total
            </span>
          </div>

          {loading ? (
            /* Loading skeleton */
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-200 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-slate-200 rounded w-48" />
                      <div className="h-3 bg-slate-100 rounded w-32" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : urls.length === 0 ? (
            /* Empty state */
            <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">No URLs yet</h3>
              <p className="text-sm text-slate-400">
                Add your first Render service URL above to start monitoring.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {urls.map((item) => (
                <UrlCard
                  key={item._id}
                  item={item}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-slate-300">
        Pings every 14 min &middot; Render free tier safe
      </footer>
    </div>
  );
}

export default Dashboard;