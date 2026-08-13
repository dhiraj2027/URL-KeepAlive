import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import AddUrl from "./AddUrl.jsx";
import UrlCard from "./UrlCard.jsx";

import {
  getUrls,
  createUrl,
  updateUrl,
  deleteUrl
} from "../services/api.js";

const REFRESH_INTERVAL_MS =
  Number(
    import.meta.env
      .VITE_STATUS_REFRESH_MS ||
      5000
  );

function Dashboard({
  user,
  onLogout,
  onUnauthorized
}) {
  const [
    urls,
    setUrls
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    refreshing,
    setRefreshing
  ] = useState(false);

  const [
    error,
    setError
  ] = useState("");

  const requestInFlight =
    useRef(false);

  const loadUrls =
    useCallback(
      async ({
        initial = false
      } = {}) => {
        /*
         * Never allow polling requests to stack.
         */
        if (
          requestInFlight.current
        ) {
          return;
        }

        requestInFlight.current =
          true;

        if (initial) {
          setLoading(true);
        }

        try {
          const response =
            await getUrls();

          const nextUrls =
            Array.isArray(
              response?.urls
            )
              ? response.urls
              : [];

          setUrls(nextUrls);
          setError("");
        } catch (err) {
          if (
            err.status === 401
          ) {
            onUnauthorized();
            return;
          }

          setError(
            err.message ||
              "Failed to load URLs."
          );
        } finally {
          requestInFlight.current =
            false;

          if (initial) {
            setLoading(false);
          }
        }
      },
      [onUnauthorized]
    );

  /*
   * Initial load.
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUrls({
      initial: true
    });
  }, [loadUrls]);

  /*
   * Poll only while the tab is visible.
   *
   * If a previous request is still running,
   * loadUrls() simply returns.
   */
  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          if (
            document.hidden
          ) {
            return;
          }

          void loadUrls();
        },
        REFRESH_INTERVAL_MS
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, [loadUrls]);

  const handleRefresh =
    async () => {
      if (
        requestInFlight.current
      ) {
        return;
      }

      setRefreshing(true);

      try {
        await loadUrls();
      } finally {
        setRefreshing(false);
      }
    };

  const handleAdd =
    async (
      url,
      name
    ) => {
      try {
        setError("");

        await createUrl(
          url,
          name
        );

        /*
         * Immediately display the new document.
         * The initial ping happens independently
         * on the backend.
         */
        await loadUrls();

        return true;
      } catch (err) {
        if (
          err.status === 401
        ) {
          onUnauthorized();
          return false;
        }

        setError(
          err.message ||
            "Failed to add URL."
        );

        return false;
      }
    };

  const handleToggle =
    async (
      id,
      enabled
    ) => {
      try {
        setError("");

        await updateUrl(
          id,
          {
            enabled
          }
        );

        await loadUrls();
      } catch (err) {
        if (
          err.status === 401
        ) {
          onUnauthorized();
          return;
        }

        setError(
          err.message ||
            "Failed to update URL."
        );
      }
    };

  const handleDelete =
    async (id) => {
      try {
        setError("");

        await deleteUrl(id);

        setUrls(
          (current) =>
            current.filter(
              (item) =>
                item._id !== id
            )
        );
      } catch (err) {
        if (
          err.status === 401
        ) {
          onUnauthorized();
          return;
        }

        setError(
          err.message ||
            "Failed to delete URL."
        );
      }
    };

  const totalCount =
    urls.length;

  const healthyCount =
    useMemo(
      () =>
        urls.filter(
          (item) =>
            item.enabled &&
            item.lastStatus ===
              "healthy"
        ).length,
      [urls]
    );

  const failedCount =
    useMemo(
      () =>
        urls.filter(
          (item) =>
            item.enabled &&
            item.lastStatus ===
              "failed"
        ).length,
      [urls]
    );

  const pendingCount =
    useMemo(
      () =>
        urls.filter(
          (item) =>
            item.enabled &&
            item.lastStatus ===
              "unknown"
        ).length,
      [urls]
    );

  return (
    <div className="min-h-screen bg-slate-50">
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

          <span className="font-bold text-sm">
            URL KeepAlive
          </span>
        </div>

        <div className="flex items-center gap-5">
          <span className="text-slate-400 text-xs hidden sm:block">
            {user.email}
          </span>

          <button
            type="button"
            onClick={
              onLogout
            }
            className="text-xs text-slate-300 hover:text-white font-medium"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <section className="mb-10">
          <p className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-3">
            Automated URL Monitoring
          </p>

          <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 tracking-tight leading-none mb-4">
            Add once.
            <br />
            Run automatically.
          </h1>

          <p className="text-slate-500 max-w-xl leading-relaxed">
            Monitor your service URLs
            automatically and see their
            latest health status here.
          </p>
        </section>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            [
              "Total",
              totalCount,
              "text-slate-900"
            ],
            [
              "Healthy",
              healthyCount,
              "text-emerald-600"
            ],
            [
              "Failed",
              failedCount,
              "text-red-500"
            ],
            [
              "Pending",
              pendingCount,
              "text-amber-500"
            ]
          ].map(
            ([
              label,
              value,
              color
            ]) => (
              <div
                key={label}
                className="bg-white border border-slate-200 rounded-2xl px-4 py-4 text-center"
              >
                <p
                  className={`text-2xl font-bold ${color}`}
                >
                  {value}
                </p>

                <p className="text-xs text-slate-400 mt-0.5">
                  {label}
                </p>
              </div>
            )
          )}
        </div>

        <AddUrl
          onAdd={handleAdd}
        />

        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-6 flex justify-between gap-3"
          >
            <span>
              {error}
            </span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="font-bold"
            >
              ×
            </button>
          </div>
        )}

        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-900">
                Your URLs
              </h2>

              <p className="text-xs text-slate-400 mt-1">
                Status updates automatically
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={
                  handleRefresh
                }
                disabled={
                  refreshing
                }
                className="text-xs font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50"
              >
                {refreshing
                  ? "Refreshing…"
                  : "Refresh"}
              </button>

              <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                {totalCount} total
              </span>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(
                (item) => (
                  <div
                    key={item}
                    className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse"
                  >
                    <div className="h-4 bg-slate-200 rounded w-48" />
                  </div>
                )
              )}
            </div>
          ) : urls.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center">
              <h3 className="font-semibold text-slate-900 mb-1">
                No URLs yet
              </h3>

              <p className="text-sm text-slate-400">
                Add your first service
                URL above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {urls.map(
                (item) => (
                  <UrlCard
                    key={item._id}
                    item={item}
                    onToggle={
                      handleToggle
                    }
                    onDelete={
                      handleDelete
                    }
                  />
                )
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="text-center py-8 text-xs text-slate-300">
        Automatic URL monitoring
      </footer>
    </div>
  );
}

export default Dashboard;