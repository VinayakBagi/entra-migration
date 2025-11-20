import express from "express";
import authController from "../controllers/auth.controller.js";

const router = express.Router();

router.post(
  "/check-dummy-user-first-sign-in",
  authController.checkDummyUserFirstSignInAttributeCollectionStart
);

router.post(
  "/check-dummy-user-first-sign-in-token-issuance-start",
  authController.checkDummyUserFirstSignInTokenIssuanceStart
);
export default router;
