import { useState } from "react";

const STATUS = {
  healthy: {
    dot: "bg-emerald-500",
    ping: "bg-emerald-400",
    badge:
      "bg-emerald-50 text-emerald-700",
    label: "Healthy",
    pulse: true
  },

  failed: {
    dot: "bg-red-500",
    ping: "",
    badge:
      "bg-red-50 text-red-600",
    label: "Failed",
    pulse: false
  },

  unknown: {
    dot: "bg-amber-400",
    ping: "",
    badge:
      "bg-amber-50 text-amber-700",
    label: "Pending",
    pulse: false
  }
};

function UrlCard({
  item,
  onToggle,
  onDelete
}) {
  const [
    confirmDelete,
    setConfirmDelete
  ] = useState(false);

  const [
    toggling,
    setToggling
  ] = useState(false);

  const [
    deleting,
    setDeleting
  ] = useState(false);

  const status =
    item.enabled
      ? STATUS[
          item.lastStatus
        ] || STATUS.unknown
      : {
          ...STATUS.unknown,
          label: "Disabled",
          dot: "bg-slate-400",
          badge:
            "bg-slate-100 text-slate-500",
          pulse: false
        };

  const handleToggle =
    async () => {
      if (toggling) {
        return;
      }

      setToggling(true);

      try {
        await onToggle(
          item._id,
          !item.enabled
        );
      } finally {
        setToggling(false);
      }
    };

  const handleDelete =
    async () => {
      if (deleting) {
        return;
      }

      setDeleting(true);

      try {
        await onDelete(
          item._id
        );
      } finally {
        setDeleting(false);
        setConfirmDelete(false);
      }
    };

  return (
    <article className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="relative mt-1.5 flex-shrink-0 w-2.5 h-2.5">
          <div
            className={`w-2.5 h-2.5 rounded-full ${status.dot}`}
          />

          {status.pulse && (
            <div
              className={`absolute inset-0 rounded-full ${status.ping} animate-ping opacity-60`}
            />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 text-sm break-all">
              {item.name ||
                item.url}
            </h3>

            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.badge}`}
            >
              {status.label}
            </span>

            {item.enabled &&
              item.lastStatusCode !==
                null &&
              item.lastStatusCode !==
                undefined && (
                <span className="text-xs text-slate-400">
                  HTTP{" "}
                  {
                    item.lastStatusCode
                  }
                </span>
              )}
          </div>

          {item.name && (
            <p className="text-xs text-slate-400 mt-0.5 break-all">
              {item.url}
            </p>
          )}

          <p className="text-xs text-slate-400 mt-1">
            {item.lastPingAt
              ? `Last ping: ${new Date(
                  item.lastPingAt
                ).toLocaleString()}`
              : "Not pinged yet"}
          </p>

          {item.lastError && (
            <p className="text-xs text-red-500 mt-1 break-words">
              {item.lastError}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={
            handleToggle
          }
          disabled={toggling}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
            item.enabled
              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {toggling
            ? "…"
            : item.enabled
              ? "Disable"
              : "Enable"}
        </button>

        {confirmDelete ? (
          <>
            <button
              type="button"
              onClick={
                handleDelete
              }
              disabled={deleting}
              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting
                ? "…"
                : "Confirm"}
            </button>

            <button
              type="button"
              onClick={() =>
                setConfirmDelete(
                  false
                )
              }
              disabled={deleting}
              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() =>
              setConfirmDelete(
                true
              )
            }
            className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-50 text-red-600 hover:bg-red-100"
          >
            Delete
          </button>
        )}
      </div>
    </article>
  );
}

export default UrlCard;