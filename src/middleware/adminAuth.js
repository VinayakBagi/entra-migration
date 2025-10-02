import { logger } from "../utils/logger.js";

export function adminAuth(req, res, next) {
  const apiKey = req.headers["x-admin-api-key"];

  if (!apiKey) {
    logger.warn("Admin auth failed: Missing API key");
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing API key",
    });
  }

  if (apiKey !== process.env.ADMIN_API_KEY) {
    logger.warn("Admin auth failed: Invalid API key");
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid API key",
    });
  }

  next();
}
