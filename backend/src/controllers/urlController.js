import mongoose from "mongoose";

import Url from "../models/Url.js";
import {
  normalizeUrl,
  pingUrlById
} from "../services/urlPingService.js";

const MAX_URLS_PER_USER = 50;

const getUrls = async (
  req,
  res
) => {
  try {
    const urls =
      await Url.find({
        user: req.user.id
      })
        .sort({
          createdAt: -1
        })
        .lean();

    return res.json({
      success: true,
      urls
    });
  } catch (error) {
    console.error(
      "[URL] Get URLs error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch URLs"
    });
  }
};

const createUrl = async (
  req,
  res
) => {
  try {
    const rawUrl =
      typeof req.body?.url ===
      "string"
        ? req.body.url
        : "";

    const name =
      typeof req.body?.name ===
      "string"
        ? req.body.name.trim()
        : "";

    if (!rawUrl.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "URL is required"
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message:
          "Name must be 100 characters or less"
      });
    }

    let normalizedUrl;

    try {
      normalizedUrl =
        await normalizeUrl(
          rawUrl
        );
    } catch (error) {
      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Invalid URL"
      });
    }

    const urlCount =
      await Url.countDocuments({
        user: req.user.id
      });

    if (
      urlCount >=
      MAX_URLS_PER_USER
    ) {
      return res.status(400).json({
        success: false,
        message: `You can monitor up to ${MAX_URLS_PER_USER} URLs`
      });
    }

    const newUrl =
      await Url.create({
        user: req.user.id,
        url: normalizedUrl,
        name,
        enabled: true
      });

    /*
     * Start the first ping in the background.
     *
     * We intentionally don't await this.
     * Creating a URL should be fast and should
     * not make the API wait for the monitored
     * server.
     */
    void pingUrlById(
      newUrl._id
    ).catch((error) => {
      console.error(
        "[URL] Initial ping error:",
        error
      );
    });

    return res.status(201).json({
      success: true,
      url: newUrl
    });
  } catch (error) {
    console.error(
      "[URL] Create URL error:",
      error
    );

    if (
      error?.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message:
          "You already added this URL"
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to add URL"
    });
  }
};

const updateUrl = async (
  req,
  res
) => {
  try {
    const {
      id
    } = req.params;

    if (
      !mongoose.isValidObjectId(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid URL id"
      });
    }

    const urlDoc =
      await Url.findOne({
        _id: id,
        user: req.user.id
      });

    if (!urlDoc) {
      return res.status(404).json({
        success: false,
        message:
          "URL not found"
      });
    }

    if (
      typeof req.body?.name ===
      "string"
    ) {
      const name =
        req.body.name.trim();

      if (name.length > 100) {
        return res.status(400).json({
          success: false,
          message:
            "Name must be 100 characters or less"
        });
      }

      urlDoc.name = name;
    }

    if (
      typeof req.body?.enabled ===
      "boolean"
    ) {
      urlDoc.enabled =
        req.body.enabled;
    }

    await urlDoc.save();

    /*
     * If re-enabled, immediately check it.
     */
    if (urlDoc.enabled) {
      void pingUrlById(
        urlDoc._id
      ).catch((error) => {
        console.error(
          "[URL] Re-enable ping error:",
          error
        );
      });
    }

    return res.json({
      success: true,
      url: urlDoc
    });
  } catch (error) {
    console.error(
      "[URL] Update URL error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update URL"
    });
  }
};

const deleteUrl = async (
  req,
  res
) => {
  try {
    const {
      id
    } = req.params;

    if (
      !mongoose.isValidObjectId(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid URL id"
      });
    }

    const deleted =
      await Url.findOneAndDelete({
        _id: id,
        user: req.user.id
      });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message:
          "URL not found"
      });
    }

    return res.json({
      success: true,
      message:
        "URL deleted"
    });
  } catch (error) {
    console.error(
      "[URL] Delete URL error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete URL"
    });
  }
};

export {
  getUrls,
  createUrl,
  updateUrl,
  deleteUrl
};