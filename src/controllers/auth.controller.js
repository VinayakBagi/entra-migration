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

  checkDummyUser = async (req, res) => {
    try {
      logger.info("=== Received Authentication Request ===");
      logger.info("Request Body:", req.body);

      const authEvent = req.body;

      // Extract user information
      const userId = authEvent?.data?.authenticationContext?.user?.id;
      const userEmail = authEvent?.data?.authenticationContext?.user?.mail;
      const attributes = authEvent?.data?.userSignUpInfo?.attributes || {};

      logger.info(`User Details - ID: ${userId}, Email: ${userEmail}`);

      // Find extension attribute 1
      let extensionAttr1 = null;
      let extensionAttrKey = null;

      for (const [key, value] of Object.entries(attributes)) {
        // Check for various possible naming conventions
        if (
          key.toLowerCase().includes("extensionattribute1") ||
          key.toLowerCase().includes("extension_attribute_1") ||
          key.toLowerCase().includes("extension_attribute1")
        ) {
          extensionAttr1 = value?.value;
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
          logger.info("🚫 BLOCKING USER - Dummy user attempting first sign-in");

          // Return block page response
          const blockResponse = {
            status: "blocked",
            statusCode: 403,
            message: "Dummy user blocked on first sign-in",
            user: {
              id: userId,
              email: userEmail,
            },
            data: {
              "@odata.type":
                "microsoft.graph.onAttributeCollectionSubmitResponseData",
              actions: [
                {
                  "@odata.type":
                    "microsoft.graph.attributeCollectionSubmit.showBlockPage",
                  title: "Access Denied",
                  message:
                    "Dummy user accounts are restricted from signing in for the first time. Please contact your system administrator for assistance.",
                },
              ],
            },
          };

          logger.info("Block Response Sent:", blockResponse);
          return res.status(403).json(blockResponse);
        } else {
          logger.info("✓ Allowing sign-in - User has signed in before");
        }

        // Track this sign-in (mark user as having signed in)
        signedInUsers.add(userId);
        logger.info(`User ${userId} added to signed-in tracking`);
      } else {
        logger.info(
          "✓ Normal user (not a dummy user) - continuing with default behavior"
        );
      }

      // Continue with normal authentication flow
      const continueResponse = {
        status: "success",
        statusCode: 200,
        message: "Authentication allowed",
        user: {
          id: userId,
          email: userEmail,
        },
        data: {
          "@odata.type":
            "microsoft.graph.onAttributeCollectionSubmitResponseData",
          actions: [
            {
              "@odata.type":
                "microsoft.graph.attributeCollectionSubmit.continueWithDefaultBehavior",
            },
          ],
        },
      };

      logger.info("✓ Continue Response Sent:", continueResponse);
      return res.status(200).json(continueResponse);
    } catch (error) {
      logger.error("❌ ERROR occurred:", error);
      logger.error("Error stack:", error.stack);

      // On error, continue with default behavior to avoid blocking legitimate users
      const errorResponse = {
        data: {
          "@odata.type":
            "microsoft.graph.onAttributeCollectionSubmitResponseData",
          actions: [
            {
              "@odata.type":
                "microsoft.graph.attributeCollectionSubmit.continueWithDefaultBehavior",
            },
          ],
        },
      };

      return res.status(200).json(errorResponse);
    }
  };
}

export default new AuthController();
