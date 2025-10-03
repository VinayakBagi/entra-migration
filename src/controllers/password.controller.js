import passwordService from "../services/password.service.js";
import { logger } from "../utils/logger.js";

class PasswordController {
  async updatePassword(req, res) {
    try {
      const userId = parseInt(req.params.userId);
      const { password } = req.body;

      if (isNaN(userId)) {
        return res.status(400).json({
          error: "Invalid user ID",
        });
      }

      if (!password || password.length < 8) {
        return res.status(400).json({
          error: "Password must be at least 8 characters",
        });
      }

      const result = await passwordService.updatePassword(userId, password);

      if (result.success) {
        res.json({
          message: "Password updated successfully",
          data: {
            updatedInDB: result.updatedInDB,
            updatedInEntra: result.updatedInEntra,
          },
        });
      } else {
        res.status(400).json({
          error: "Password update failed",
          details: result.error,
        });
      }
    } catch (error) {
      logger.error("Password update error", error);
      res.status(500).json({
        error: "Password update failed",
        details: error.message,
      });
    }
  }

  async resetPassword(req, res) {
    try {
      const userId = parseInt(req.params.userId);

      if (isNaN(userId)) {
        return res.status(400).json({
          error: "Invalid user ID",
        });
      }

      const result = await passwordService.resetPassword(userId);

      if (result.success) {
        res.json({
          message: "Password reset successfully",
          data: {
            temporaryPassword: result.temporaryPassword,
            updatedInDB: result.updatedInDB,
            updatedInEntra: result.updatedInEntra,
          },
        });
      } else {
        res.status(400).json({
          error: "Password reset failed",
          details: result.error,
        });
      }
    } catch (error) {
      logger.error("Password reset error", error);
      res.status(500).json({
        error: "Password reset failed",
        details: error.message,
      });
    }
  }
}

export default new PasswordController();
