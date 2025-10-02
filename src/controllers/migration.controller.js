import migrationService from "../services/migration.service.js";
import { logger } from "../utils/logger.js";

class MigrationController {
  getStatus = async (req, res) => {
    try {
      const stats = await migrationService.getMigrationProgress();

      res.json({
        status: "operational",
        timestamp: new Date().toISOString(),
        stats,
      });
    } catch (error) {
      logger.error("Error fetching migration status", error);
      res.status(500).json({
        error: "Failed to fetch migration status",
        details: error.message,
      });
    }
  };

  startBulkMigration = async (req, res) => {
    try {
      const { batchSize, delayBetweenBatches, limit, sendEmails } = req.body;

      logger.info("Bulk migration requested", { batchSize, limit });

      const results = await migrationService.bulkMigrate({
        batchSize: batchSize || 50,
        delayBetweenBatches: delayBetweenBatches || 2000,
        limit: limit || null,
        sendEmails: sendEmails || false,
      });

      res.json({
        message: "Bulk migration completed",
        summary: {
          totalProcessed: results.totalProcessed,
          successful: results.successful,
          failed: results.failed,
          skipped: results.skipped,
        },
        results: results.results,
      });
    } catch (error) {
      logger.error("Bulk migration error", error);
      res.status(500).json({
        error: "Bulk migration failed",
        details: error.message,
      });
    }
  };

  migrateSingleUser = async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { sendEmail } = req.body;

      if (isNaN(userId)) {
        return res.status(400).json({
          error: "Invalid user ID",
        });
      }

      const result = await migrationService.migrateSingleUser(userId, {
        sendEmail: sendEmail || false,
      });

      if (result.success) {
        res.json({
          message: "User migrated successfully",
          data: result,
        });
      } else {
        res.status(400).json({
          error: "Migration failed",
          details: result.error,
        });
      }
    } catch (error) {
      logger.error("Single user migration error", error);
      res.status(500).json({
        error: "Migration failed",
        details: error.message,
      });
    }
  };

  getProgress = async (req, res) => {
    try {
      const progress = await migrationService.getMigrationProgress();

      res.json({
        message: "Migration progress",
        data: progress,
      });
    } catch (error) {
      logger.error("Error fetching migration progress", error);
      res.status(500).json({
        error: "Failed to fetch migration progress",
        details: error.message,
      });
    }
  };
}

export default new MigrationController();
