import { logger } from "../utils/logger.js";

export function errorHandler(err, req, res, next) {
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: "Not found",
    message: `Route ${req.url} not found`,
  });
}
