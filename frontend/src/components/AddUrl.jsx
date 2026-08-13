import { useState } from "react";

function AddUrl({ onAdd }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();

    if (!url.trim() || loading) return;

    setLoading(true);
    try {
      const ok = await onAdd(url.trim(), name.trim());
      // Only clear inputs when the add actually succeeded
      if (ok) {
        setUrl("");
        setName("");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 mb-8">
      <input
        type="text"
        placeholder="Name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={loading}
        className="sm:w-44 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:opacity-50 transition"
      />
      <input
        type="url"
        placeholder="https://your-service.onrender.com/health"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
        disabled={loading}
        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:opacity-50 transition"
      />
      <button
        type="submit"
        disabled={loading}
        className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold whitespace-nowrap hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Adding…" : "Add URL"}
      </button>
    </form>
  );
}

export default AddUrl;