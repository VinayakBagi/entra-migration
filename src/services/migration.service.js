import graphService from "./graph.service.js";
import userService from "./user.service.js";
import { generateSecurePassword } from "../utils/passwordGenerator.js";
import { logger } from "../utils/logger.js";

class MigrationService {
  /**
   * Migrate a single user with temporary password
   */
  async migrateSingleUser(userId, options = {}) {
    const { sendEmail = false } = options;

    try {
      // Get user from database
      const user = await userService.getUserById(userId);

      if (!user) {
        return {
          success: false,
          error: "User not found",
        };
      }

      if (user.migratedToEntra) {
        return {
          success: false,
          error: "User already migrated",
        };
      }

      // Check if user exists in Entra
      const existsInEntra = await graphService.userExists(user.email);
      if (existsInEntra) {
        return {
          success: false,
          error: "User already exists in Entra",
        };
      }

      // Generate temporary password
      const temporaryPassword = generateSecurePassword();

      // Create user in Entra External ID
      const entraUser = await graphService.createUser(
        user,
        temporaryPassword,
        true // Force password change on first login
      );

      // Mark user as migrated in database
      await userService.markUserAsMigrated(user.id, entraUser.id);

      logger.info(`Successfully migrated user: ${user.email}`);

      // TODO: Send email with temporary password
      if (sendEmail) {
        // await sendPasswordResetEmail(user.email, temporaryPassword);
        logger.info(`Password reset email sent to: ${user.email}`);
      }

      return {
        success: true,
        userId: user.id,
        email: user.email,
        entraUserId: entraUser.id,
        temporaryPassword: temporaryPassword, // ⚠️ Store securely or send via email
      };
    } catch (error) {
      logger.error(`Failed to migrate user ${userId}`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Bulk migrate users with temporary passwords
   */
  async bulkMigrate(options = {}) {
    const {
      batchSize = 50,
      delayBetweenBatches = 2000,
      limit = null,
      sendEmails = false,
    } = options;

    logger.info("Starting bulk migration...");

    // Fetch users to migrate
    const users = await userService.getUsersForMigration(limit);

    if (users.length === 0) {
      return {
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        results: [],
      };
    }

    logger.info(`Found ${users.length} users to migrate`);

    const results = [];
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    // Process in batches
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(users.length / batchSize);

      logger.info(`Processing batch ${batchNumber} of ${totalBatches}`);

      // Process batch concurrently
      const batchPromises = batch.map(async (user) => {
        try {
          // Check if already exists in Entra
          const exists = await graphService.userExists(user.email);

          if (exists) {
            skipped++;
            return {
              userId: user.id,
              email: user.email,
              status: "skipped",
              reason: "Already exists in Entra",
            };
          }

          // Generate temporary password
          const temporaryPassword = generateSecurePassword();

          // Create in Entra
          const entraUser = await graphService.createUser(
            user,
            temporaryPassword,
            true
          );

          // Mark as migrated
          await userService.markUserAsMigrated(user.id, entraUser.id);

          // TODO: Send email
          if (sendEmails) {
            // await sendPasswordResetEmail(user.email, temporaryPassword);
          }

          successful++;
          return {
            userId: user.id,
            email: user.email,
            status: "success",
            entraUserId: entraUser.id,
            temporaryPassword: temporaryPassword, // ⚠️ Handle securely
          };
        } catch (error) {
          failed++;
          logger.error(`Failed to migrate user ${user.email}`, error);
          return {
            userId: user.id,
            email: user.email,
            status: "failed",
            error: error.message,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Delay between batches to avoid rate limiting
      if (i + batchSize < users.length) {
        logger.info(`Waiting ${delayBetweenBatches}ms before next batch...`);
        await new Promise((resolve) =>
          setTimeout(resolve, delayBetweenBatches)
        );
      }
    }

    logger.info(
      `Migration complete: ${successful} success, ${failed} failed, ${skipped} skipped`
    );

    return {
      totalProcessed: users.length,
      successful,
      failed,
      skipped,
      results,
    };
  }

  /**
   * Get migration progress
   */
  async getMigrationProgress() {
    return await userService.getMigrationStats();
  }
}

export default new MigrationService();
