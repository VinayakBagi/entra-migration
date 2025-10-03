import bcrypt from "bcrypt";
import userService from "./user.service.js";
import graphService from "./graph.service.js";
import { logger } from "../utils/logger.js";

class PasswordService {
  async updatePasswordInDB(userId, newPassword) {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      logger.info(`Password updated in DB for user: ${updated.email}`);
      return { success: true };
    } catch (error) {
      logger.error(`Failed to update password in DB for user ${userId}`, error);
      throw error;
    }
  }

  async updatePasswordInEntra(userId, newPassword) {
    try {
      const user = await userService.getUserById(userId);

      if (!user.entraUserId) {
        throw new Error("User not migrated to Entra yet");
      }

      const graphClient = graphService.getClient();

      await graphClient.api(`/users/${user.entraUserId}`).patch({
        passwordProfile: {
          forceChangePasswordNextSignIn: false,
          password: newPassword,
        },
      });

      logger.info(`Password updated in Entra for user: ${user.email}`);
      return { success: true };
    } catch (error) {
      logger.error(
        `Failed to update password in Entra for user ${userId}`,
        error
      );
      throw error;
    }
  }

  async updatePassword(userId, newPassword) {
    try {
      const user = await userService.getUserById(userId);

      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Update in old database
      await this.updatePasswordInDB(userId, newPassword);

      // Update in Entra if user is migrated
      if (user.migratedToEntra && user.entraUserId) {
        await this.updatePasswordInEntra(userId, newPassword);
      }

      return {
        success: true,
        updatedInDB: true,
        updatedInEntra: user.migratedToEntra,
      };
    } catch (error) {
      logger.error(`Failed to update password for user ${userId}`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async resetPassword(userId) {
    try {
      const { generateSecurePassword } = await import(
        "../utils/passwordGenerator.js"
      );
      const newPassword = generateSecurePassword();

      const result = await this.updatePassword(userId, newPassword);

      if (result.success) {
        return {
          success: true,
          temporaryPassword: newPassword,
          updatedInDB: result.updatedInDB,
          updatedInEntra: result.updatedInEntra,
        };
      }

      return result;
    } catch (error) {
      logger.error(`Failed to reset password for user ${userId}`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default new PasswordService();
