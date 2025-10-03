import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userService from "./user.service.js";
import graphService from "./graph.service.js";
import { generateSecurePassword } from "../utils/passwordGenerator.js";
import { logger } from "../utils/logger.js";

class AuthService {
  /**
   * Login with JIT (Just-in-Time) - this migrates the user's actual password during login
   */
  async loginWithJIT(email, password) {
    try {
      const user = await userService.getUserByEmail(email);

      if (!user) {
        return {
          success: false,
          error: "Invalid email or password",
        };
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return {
          success: false,
          error: "Invalid email or password",
        };
      }

      if (!user.migratedToEntra) {
        logger.info(`JIT Migration: Migrating user ${email}...`);

        try {
          const entraUser = await graphService.createUser(
            user,
            password, // Their actual plaintext password
            false // Don't force password change
          );

          // Mark as migrated
          await userService.markUserAsMigrated(user.id, entraUser.id);

          logger.info(`JIT Migration successful for ${email}`);
        } catch (error) {
          logger.error(`JIT Migration failed for ${email}`, error);
        }
      }

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          username: user.username,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      return {
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          migratedToEntra: user.migratedToEntra,
        },
      };
    } catch (error) {
      logger.error("Login error", error);
      return {
        success: false,
        error: "An error occurred during login",
      };
    }
  }
}

export default new AuthService();
