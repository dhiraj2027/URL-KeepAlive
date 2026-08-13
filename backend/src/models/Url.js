import mongoose from "mongoose";

const urlSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    url: {
      type: String,
      required: true,
      trim: true
    },

    name: {
      type: String,
      default: ""
    },

    enabled: {
      type: Boolean,
      default: true
    },

    lastStatus: {
      type: String,
      enum: ["unknown", "healthy", "failed"],
      default: "unknown"
    },

    lastStatusCode: {
      type: Number,
      default: null
    },

    lastPingAt: {
      type: Date,
      default: null
    },

    lastError: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

urlSchema.index(
  { user: 1, url: 1 },
  { unique: true }
);

const Url = mongoose.model("Url", urlSchema);

export default Url;