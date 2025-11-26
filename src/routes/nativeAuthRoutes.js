import express from "express";
import fetch from "node-fetch";
import { logger } from "../utils/logger.js";
import graphService from "../services/graph.service.js";

const router = express.Router();

// Configuration from environment variables
// const TENANT_SUBDOMAIN = process.env.ENTRA_TENANT_SUBDOMAIN;
// const TENANT_DOMAIN = process.env.ENTRA_TENANT_NAME;
// const CLIENT_ID =
//   process.env.ENTRA_NATIVE_AUTH_CLIENT_ID || process.env.ENTRA_CLIENT_ID;
// const BASE_URL = `https://${TENANT_SUBDOMAIN}.ciamlogin.com/${TENANT_DOMAIN}/resetpassword/v1.0`;

const TENANT_SUBDOMAIN = "devmtyfranchise";
const TENANT_DOMAIN = "devmtyfranchise.onmicrosoft.com";
const CLIENT_ID = "bc8c1d14-0092-43df-b75a-8b0b6bc997d9";
const BASE_URL = `https://${TENANT_SUBDOMAIN}.ciamlogin.com/${TENANT_DOMAIN}/resetpassword/v1.0`;

/**
 * Step 1: Start password reset - Initiates SSPR and sends OTP
 */
router.post("/start", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    logger.info(`SSPR start request for: ${email}`);

    // Check if user exists and is dummy
    const user = await graphService.getUserByEmail(email);

    if (!user) {
      // Don't reveal if user exists
      return res.json({
        success: false,
        message: "If this email exists, a verification code has been sent.",
      });
    }

    // Check if dummy user
    const userData = await graphService.getUserExtensionAttributes(user.id);
    const extensionAttr1 = graphService.extractExtensionAttribute1(userData);
    const isDummyUser =
      extensionAttr1 && extensionAttr1.toString().toUpperCase() === "Y";

    if (isDummyUser) {
      logger.info(`Dummy user detected: ${email}`);
      return res.json({
        success: false,
        isDummyUser: true,
        message: "This is a test account. Please contact your administrator.",
      });
    }

    // Call Entra Native Auth API - Start endpoint
    const startResponse = await fetch(`${BASE_URL}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        challenge_type: "oob redirect", // OTP via email
        username: email,
      }),
    });

    const startData = await startResponse.json();

    if (!startResponse.ok) {
      logger.error("SSPR start failed:", startData);
      return res.status(400).json({
        error: startData.error_description || "Failed to start password reset",
      });
    }

    logger.info(`SSPR started successfully for: ${email}`);

    // Return continuation token to frontend
    return res.json({
      success: true,
      continuationToken: startData.continuation_token,
      message: "Verification code sent to your email",
    });
  } catch (error) {
    logger.error("Error starting SSPR:", error);
    return res.status(500).json({
      error: "Failed to start password reset",
    });
  }
});

/**
 * Step 2: Challenge - Request OTP to be sent (auto-sent in start, but can be called separately)
 */
router.post("/challenge", async (req, res) => {
  try {
    const { continuationToken } = req.body;

    if (!continuationToken) {
      return res.status(400).json({ error: "Continuation token is required" });
    }

    // Call Entra Native Auth API - Challenge endpoint
    const challengeResponse = await fetch(`${BASE_URL}/challenge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        challenge_type: "oob redirect",
        continuation_token: continuationToken,
      }),
    });

    const challengeData = await challengeResponse.json();

    if (!challengeResponse.ok) {
      logger.error("SSPR challenge failed:", challengeData);
      return res.status(400).json({
        error: challengeData.error_description || "Failed to send OTP",
      });
    }

    return res.json({
      success: true,
      continuationToken: challengeData.continuation_token,
      challengeType: challengeData.challenge_type,
      challengeChannel: challengeData.challenge_channel,
      codeLength: challengeData.code_length,
      message: "OTP sent successfully",
    });
  } catch (error) {
    logger.error("Error in SSPR challenge:", error);
    return res.status(500).json({
      error: "Failed to send OTP",
    });
  }
});

/**
 * Step 3: Continue - Verify OTP
 */
router.post("/verify-otp", async (req, res) => {
  try {
    const { continuationToken, otp } = req.body;

    if (!continuationToken || !otp) {
      return res.status(400).json({
        error: "Continuation token and OTP are required",
      });
    }

    logger.info("Verifying OTP...");

    // Call Entra Native Auth API - Continue endpoint
    const continueResponse = await fetch(`${BASE_URL}/continue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        continuation_token: continuationToken,
        grant_type: "oob",
        oob: otp,
      }),
    });

    const continueData = await continueResponse.json();

    if (!continueResponse.ok) {
      logger.error("OTP verification failed:", continueData);
      return res.status(400).json({
        error: continueData.error_description || "Invalid or expired OTP",
      });
    }

    logger.info("OTP verified successfully");

    return res.json({
      success: true,
      continuationToken: continueData.continuation_token,
      expiresIn: continueData.expires_in,
      message: "OTP verified successfully",
    });
  } catch (error) {
    logger.error("Error verifying OTP:", error);
    return res.status(500).json({
      error: "Failed to verify OTP",
    });
  }
});

/**
 * Step 4: Submit - Set new password
 */
router.post("/submit-password", async (req, res) => {
  try {
    const { continuationToken, newPassword } = req.body;

    if (!continuationToken || !newPassword) {
      return res.status(400).json({
        error: "Continuation token and new password are required",
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long",
      });
    }

    logger.info("Submitting new password...");

    // Call Entra Native Auth API - Submit endpoint
    const submitResponse = await fetch(`${BASE_URL}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        continuation_token: continuationToken,
        new_password: newPassword,
      }),
    });

    const submitData = await submitResponse.json();

    if (!submitResponse.ok) {
      logger.error("Password submission failed:", submitData);

      // Check for specific password policy errors
      let errorMessage =
        submitData.error_description || "Failed to reset password";

      if (submitData.suberror === "password_banned") {
        errorMessage =
          "This password is too common or has been compromised. Please choose a stronger, more unique password.";
      } else if (
        submitData.error_description &&
        submitData.error_description.includes("password")
      ) {
        // Keep the original message for other password-related errors
        errorMessage = submitData.error_description.split("Trace ID")[0].trim();
      }

      return res.status(400).json({
        error: errorMessage,
        suberror: submitData.suberror,
      });
    }

    logger.info("Password reset successful");

    // Optionally poll for completion
    const pollInterval = submitData.poll_interval || 2;

    return res.json({
      success: true,
      pollInterval: pollInterval,
      continuationToken: submitData.continuation_token,
      message: "Password reset successfully",
    });
  } catch (error) {
    logger.error("Error submitting password:", error);
    return res.status(500).json({
      error: "Failed to reset password",
    });
  }
});

/**
 * Optional Step 5: Poll for completion
 */
router.post("/poll-completion", async (req, res) => {
  try {
    const { continuationToken } = req.body;

    if (!continuationToken) {
      return res.status(400).json({ error: "Continuation token is required" });
    }

    const pollResponse = await fetch(`${BASE_URL}/poll_completion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        continuation_token: continuationToken,
      }),
    });

    const pollData = await pollResponse.json();

    if (!pollResponse.ok) {
      return res.status(400).json({
        error: pollData.error_description || "Failed to check status",
      });
    }

    return res.json({
      success: true,
      status: pollData.status,
      message:
        pollData.status === "succeeded"
          ? "Password reset complete"
          : "Processing...",
    });
  } catch (error) {
    logger.error("Error polling completion:", error);
    return res.status(500).json({
      error: "Failed to check status",
    });
  }
});

export default router;
