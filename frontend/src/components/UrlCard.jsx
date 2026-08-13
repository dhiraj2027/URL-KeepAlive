import { useState } from "react";

const STATUS = {
  healthy: {
    dot: "bg-emerald-500",
    ping: "bg-emerald-400",
    badge: "bg-emerald-50 text-emerald-700",
    label: "Healthy",
    pulse: true,
  },
  failed: {
    dot: "bg-red-500",
    ping: "",
    badge: "bg-red-50 text-red-600",
    label: "Failed",
    pulse: false,
  },
  unknown: {
    dot: "bg-amber-400",
    ping: "",
    badge: "bg-amber-50 text-amber-700",
    label: "Pending",
    pulse: false,
  },
};

function UrlCard({ item, onToggle, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const cfg = STATUS[item.lastStatus] || STATUS.unknown;

  const handleToggle = async () => {
    setToggling(true);
    try {
      await onToggle(item._id, !item.enabled);
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(item._id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      className={`bg-white border rounded-2xl p-5 flex items-start justify-between gap-4 transition-opacity ${
        !item.enabled ? "opacity-60" : ""
      } border-slate-200`}
    >
      {/* Status indicator + info */}
      <div className="flex items-start gap-3 min-w-0">
        {/* Pulsing dot for healthy, static for others */}
        <div className="relative mt-1.5 flex-shrink-0 w-2.5 h-2.5">
          <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
          {cfg.pulse && (
            <div
              className={`absolute inset-0 rounded-full ${cfg.ping} animate-ping opacity-60`}
            />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 text-sm leading-snug break-all">
              {item.name || item.url}
            </h3>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.badge}`}
            >
              {cfg.label}
            </span>
            {!item.enabled && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 flex-shrink-0">
                Disabled
              </span>
            )}
            {item.lastStatusCode && (
              <span className="text-xs text-slate-400 flex-shrink-0">
                HTTP {item.lastStatusCode}
              </span>
            )}
          </div>

          {item.name && (
            <p className="text-xs text-slate-400 mt-0.5 break-all">{item.url}</p>
          )}

          <p className="text-xs text-slate-400 mt-1">
            {item.lastPingAt
              ? `Last ping: ${new Date(item.lastPingAt).toLocaleString()}`
              : "Not pinged yet"}
          </p>

          {item.lastError && (
            <p className="text-xs text-red-500 mt-0.5">{item.lastError}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Toggle enable/disable */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
            item.enabled
              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {toggling ? "…" : item.enabled ? "Disable" : "Enable"}
        </button>

        {/* Two-step inline delete */}
        {confirmDelete ? (
          <>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {deleting ? "…" : "Confirm"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

export default UrlCard;