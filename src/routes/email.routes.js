import express from "express";
import { logger } from "../utils/logger.js";
import graphService from "../services/graph.service.js";

const router = express.Router();

/**
 * Send email on behalf of a user
 * POST /api/email/send
 * Body: {
 *   userPrincipalName: string (required),
 *   message: {
 *     subject: string (required),
 *     body: {
 *       contentType: "Text" | "HTML" (required),
 *       content: string (required)
 *     },
 *     toRecipients: [
 *       {
 *         emailAddress: {
 *           address: string (required)
 *         }
 *       }
 *     ]
 *   },
 *   saveToSentItems: boolean (optional, default: true)
 * }
 */
router.post("/send", async (req, res) => {
  try {
    const { userPrincipalName, message, saveToSentItems = true } = req.body;

    // Validate required fields
    if (!userPrincipalName) {
      return res.status(400).json({
        error: "userPrincipalName is required",
      });
    }

    if (!message) {
      return res.status(400).json({
        error: "message is required",
      });
    }

    if (!message.subject) {
      return res.status(400).json({
        error: "message.subject is required",
      });
    }

    if (!message.body || !message.body.contentType || !message.body.content) {
      return res.status(400).json({
        error: "message.body with contentType and content is required",
      });
    }

    if (!message.toRecipients || !Array.isArray(message.toRecipients) || message.toRecipients.length === 0) {
      return res.status(400).json({
        error: "message.toRecipients array with at least one recipient is required",
      });
    }

    // Validate toRecipients structure
    for (const recipient of message.toRecipients) {
      if (!recipient.emailAddress || !recipient.emailAddress.address) {
        return res.status(400).json({
          error: "Each recipient must have emailAddress.address",
        });
      }
    }

    logger.info(`Sending email on behalf of: ${userPrincipalName}`);

    // Prepare email data
    const emailData = {
      message,
      saveToSentItems,
    };

    // Send email using Graph Service
    const result = await graphService.sendMail(userPrincipalName, emailData);

    return res.json(result);
  } catch (error) {
    logger.error("Error sending email:", error);
    
    // Handle specific Graph API errors
    if (error.message && error.message.includes("not found")) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    if (error.message && error.message.includes("permission")) {
      return res.status(403).json({
        error: "Insufficient permissions to send email on behalf of this user",
      });
    }

    return res.status(500).json({
      error: error.message || "Failed to send email",
    });
  }
});

export default router;

