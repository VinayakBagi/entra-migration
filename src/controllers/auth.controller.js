import authService from "../services/auth.service.js";
import { logger } from "../utils/logger.js";

// Track users who have signed in (for dummy user check)
const signedInUsers = new Set();

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

  checkDummyUserFirstSignIn = async (req, res) => {
    try {
      logger.info("=== Received Token Issuance Request ===");
      logger.info("Request Body:", req.body);

      const authEvent = req.body;

      // Extract user information
      const userId = authEvent?.data?.authenticationContext?.user?.id;
      const userEmail = authEvent?.data?.authenticationContext?.user?.mail;
      const userPrincipalName =
        authEvent?.data?.authenticationContext?.user?.userPrincipalName;

      logger.info(
        `User Details - ID: ${userId}, Email: ${userEmail}, UPN: ${userPrincipalName}`
      );

      // For token issuance, extension attributes are in the user object
      let extensionAttr1 = null;
      let extensionAttrKey = null;

      const userObject = authEvent?.data?.authenticationContext?.user || {};

      for (const [key, value] of Object.entries(userObject)) {
        if (
          key.toLowerCase().includes("extensionattribute1") ||
          key.toLowerCase().includes("extension_attribute_1") ||
          key.toLowerCase().includes("extension_attribute1")
        ) {
          extensionAttr1 = value;
          extensionAttrKey = key;
          break;
        }
      }

      logger.info(
        `Extension Attribute Found - Key: ${extensionAttrKey}, Value: ${extensionAttr1}`
      );

      // Check if this is a dummy user (extension attribute 1 = "Y")
      if (extensionAttr1 && extensionAttr1.toString().toUpperCase() === "Y") {
        logger.info(
          "✓ User identified as DUMMY USER (Extension Attribute 1 = Y)"
        );

        // Check if this is their first sign-in
        const isFirstSignIn = !signedInUsers.has(userId);
        logger.info(
          `First Sign-In Check: ${
            isFirstSignIn ? "YES - FIRST TIME" : "NO - PREVIOUSLY SIGNED IN"
          }`
        );

        if (isFirstSignIn) {
          logger.info("🚫 BLOCKING USER - Adding block claim to token");

          // Add blocking claims to token
          // Your application MUST check these claims and deny access
          const blockResponse = {
            data: {
              "@odata.type": "microsoft.graph.onTokenIssuanceStartResponseData",
              actions: [
                {
                  "@odata.type":
                    "microsoft.graph.tokenIssuanceStart.provideClaimsForToken",
                  claims: {
                    block_signin: "true",
                    block_reason:
                      "Dummy user cannot sign in for the first time",
                    user_status: "blocked",
                  },
                },
              ],
            },
          };

          logger.info("Block Claims Added to Token:", blockResponse);
          return res.status(200).json(blockResponse);
        } else {
          logger.info("✓ Allowing sign-in - User has signed in before");
        }

        // Track this sign-in
        signedInUsers.add(userId);
        logger.info(`User ${userId} marked as signed in`);
      } else {
        logger.info("✓ Normal user (not a dummy user) - continuing");
      }

      // Continue with normal token issuance (no custom claims)
      const continueResponse = {
        data: {
          "@odata.type": "microsoft.graph.onTokenIssuanceStartResponseData",
          actions: [
            {
              "@odata.type":
                "microsoft.graph.tokenIssuanceStart.provideClaimsForToken",
            },
          ],
        },
      };

      logger.info("✓ Continue Response Sent:", continueResponse);
      return res.status(200).json(continueResponse);
    } catch (error) {
      logger.info("❌ ERROR occurred:", error);
      console.error("Error stack:", error.stack);

      // On error, continue to avoid blocking legitimate users
      const errorResponse = {
        data: {
          "@odata.type": "microsoft.graph.onTokenIssuanceStartResponseData",
          actions: [
            {
              "@odata.type":
                "microsoft.graph.tokenIssuanceStart.provideClaimsForToken",
            },
          ],
        },
      };

      return res.status(200).json(errorResponse);
    }
  };
}

export default new AuthController();
