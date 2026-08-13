import Url from "../models/Url.js";

const MAX_URLS_PER_USER = 50;

const isValidUrl = (value) => {
  try {
    const parsed = new URL(value);

    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    );
  } catch {
    return false;
  }
};

const getUrls = async (req, res) => {
  try {
    const urls = await Url.find({
      user: req.user.id
    }).sort({
      createdAt: -1
    });

    return res.json({
      success: true,
      urls
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch URLs"
    });
  }
};

const createUrl = async (req, res) => {
  try {
    const { url, name } = req.body;

    if (!url || !isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid HTTP or HTTPS URL"
      });
    }

    const normalizedUrl = url.trim();

    const urlCount = await Url.countDocuments({
      user: req.user.id
    });

    if (urlCount >= MAX_URLS_PER_USER) {
      return res.status(400).json({
        success: false,
        message: `You can monitor up to ${MAX_URLS_PER_USER} URLs`
      });
    }

    const existingUrl = await Url.findOne({
      user: req.user.id,
      url: normalizedUrl
    });

    if (existingUrl) {
      return res.status(409).json({
        success: false,
        message: "You already added this URL"
      });
    }

    const newUrl = await Url.create({
      user: req.user.id,
      url: normalizedUrl,
      name: (name || "").trim(),
      enabled: true
    });

    return res.status(201).json({
      success: true,
      url: newUrl
    });
  } catch (error) {
    console.error(error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You already added this URL"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to add URL"
    });
  }
};

const updateUrl = async (req, res) => {
  try {
    const url = await Url.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!url) {
      return res.status(404).json({
        success: false,
        message: "URL not found"
      });
    }

    if (typeof req.body.name === "string") {
      url.name = req.body.name.trim();
    }

    if (typeof req.body.enabled === "boolean") {
      url.enabled = req.body.enabled;
    }

    await url.save();

    return res.json({
      success: true,
      url
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to update URL"
    });
  }
};

const deleteUrl = async (req, res) => {
  try {
    const url = await Url.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!url) {
      return res.status(404).json({
        success: false,
        message: "URL not found"
      });
    }

    return res.json({
      success: true,
      message: "URL deleted"
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete URL"
    });
  }
};

/*
 * Internal scheduler endpoint.
 *
 * Authentication uses KEEPALIVE_SECRET,
 * not browser JWT.
 */
const getKeepAliveTargets = async (req, res) => {
  try {
    if (
      !process.env.KEEPALIVE_SECRET || 
      req.headers["x-keepalive-secret"] !== process.env.KEEPALIVE_SECRET
    ) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const urls = await Url.find({
      enabled: true
    }).select("_id url");

    return res.json({
      success: true,
      urls
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch targets"
    });
  }
};

const updatePingResult = async (req, res) => {
  try {
    if (
      !process.env.KEEPALIVE_SECRET || 
      req.headers["x-keepalive-secret"] !== process.env.KEEPALIVE_SECRET
    ) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const {
      id,
      status,
      statusCode,
      error
    } = req.body;

    const url = await Url.findById(id);

    if (!url) {
      return res.status(404).json({
        success: false,
        message: "URL not found"
      });
    }

    url.lastStatus =
      status === "healthy"
        ? "healthy"
        : "failed";

    url.lastStatusCode = statusCode || null;
    url.lastError = error || null;
    url.lastPingAt = new Date();

    await url.save();

    return res.json({
      success: true
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to save ping result"
    });
  }
};

export {
  getUrls,
  createUrl,
  updateUrl,
  deleteUrl,
  getKeepAliveTargets,
  updatePingResult
};