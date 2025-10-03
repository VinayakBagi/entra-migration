import { prisma } from "../config/index.js";
import { logger } from "../utils/logger.js";

class UserService {
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

  async getUsersForMigration(limit = null, onlyActive = true) {
    try {
      const where = {
        migratedToEntra: false,
      };

      if (onlyActive) {
        where.isActive = true;
      }

      const query = {
        where,
        orderBy: { createdAt: "asc" },
      };

      if (limit) {
        query.take = limit;
      }

      return await prisma.user.findMany(query);
    } catch (error) {
      logger.error("Error fetching users for migration", error);
      throw error;
    }
  }

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
