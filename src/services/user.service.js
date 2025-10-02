import { prisma } from "../config/index.js";
import { logger } from "../utils/logger.js";

class UserService {
  /**
   * Get user by ID
   */
  async getUserById(userId) {
    try {
      return await prisma.user.findUnique({
        where: { id: userId },
      });
    } catch (error) {
      logger.error(`Error fetching user by ID: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    try {
      return await prisma.user.findUnique({
        where: { email },
      });
    } catch (error) {
      logger.error(`Error fetching user by email: ${email}`, error);
      throw error;
    }
  }

  /**
   * Get users for migration
   */
  async getUsersForMigration(limit = null, onlyActive = true) {
    try {
      const where = {
        migratedToEntra: false,
      };

      if (onlyActive) {
        where.isActive = true;
      }

      return await prisma.user.findMany({
        where,
        take: limit,
        orderBy: { createdAt: "asc" },
      });
    } catch (error) {
      logger.error("Error fetching users for migration", error);
      throw error;
    }
  }

  /**
   * Mark user as migrated
   */
  async markUserAsMigrated(userId, entraUserId) {
    try {
      return await prisma.user.update({
        where: { id: userId },
        data: {
          migratedToEntra: true,
          entraUserId: entraUserId,
        },
      });
    } catch (error) {
      logger.error(`Error marking user as migrated: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get migration statistics
   */
  async getMigrationStats() {
    try {
      const total = await prisma.user.count();
      const migrated = await prisma.user.count({
        where: { migratedToEntra: true },
      });
      const pending = await prisma.user.count({
        where: { migratedToEntra: false, isActive: true },
      });

      return {
        total,
        migrated,
        pending,
        percentComplete: total > 0 ? ((migrated / total) * 100).toFixed(2) : 0,
      };
    } catch (error) {
      logger.error("Error fetching migration stats", error);
      throw error;
    }
  }
}

export default new UserService();
