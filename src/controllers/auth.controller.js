import authService from "../services/auth.service.js";
import { logger } from "../utils/logger.js";

class AuthController {
  loginWithJIT = async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: "Email and password are required",
        });
      }

      const result = await authService.loginWithJIT(email, password);

      if (result.success) {
        res.json({
          message: "Login successful",
          token: result.token,
          user: result.user,
        });
      } else {
        res.status(401).json({
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("Login error", error);
      res.status(500).json({
        error: "Login failed",
        details: error.message,
      });
    }
  };

  logout = async (req, res) => {
    res.json({
      message: "Logout successful",
    });
  };
}

export default new AuthController();
