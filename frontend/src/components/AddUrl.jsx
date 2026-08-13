import { useState } from "react";

function AddUrl({
  onAdd
}) {
  const [url, setUrl] =
    useState("");

  const [name, setName] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const submit =
    async (event) => {
      event.preventDefault();

      if (
        loading ||
        !url.trim()
      ) {
        return;
      }

      setLoading(true);

      try {
        const success =
          await onAdd(
            url.trim(),
            name.trim()
          );

        if (success) {
          setUrl("");
          setName("");
        }
      } finally {
        setLoading(false);
      }
    };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col sm:flex-row gap-2 mb-8"
    >
      <input
        type="text"
        value={name}
        onChange={(event) =>
          setName(
            event.target.value
          )
        }
        placeholder="Name (optional)"
        maxLength={100}
        disabled={loading}
        className="sm:w-44 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
      />

      <input
        type="url"
        value={url}
        onChange={(event) =>
          setUrl(
            event.target.value
          )
        }
        placeholder="https://your-service.onrender.com/health"
        required
        disabled={loading}
        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
      />

      <button
        type="submit"
        disabled={
          loading ||
          !url.trim()
        }
        className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold whitespace-nowrap hover:bg-slate-700 disabled:opacity-50 transition-colors"
      >
        {loading
          ? "Adding…"
          : "Add URL"}
      </button>
    </form>
  );
}

export default AddUrl;