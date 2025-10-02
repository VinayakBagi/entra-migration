export function validateMigrationRequest(req, res, next) {
  const { batchSize, delayBetweenBatches, limit } = req.body;

  if (batchSize && (batchSize < 1 || batchSize > 200)) {
    return res.status(400).json({
      error: "Validation error",
      message: "batchSize must be between 1 and 200",
    });
  }

  if (delayBetweenBatches && delayBetweenBatches < 1000) {
    return res.status(400).json({
      error: "Validation error",
      message: "delayBetweenBatches must be at least 1000ms",
    });
  }

  if (limit && limit < 1) {
    return res.status(400).json({
      error: "Validation error",
      message: "limit must be greater than 0",
    });
  }

  next();
}
