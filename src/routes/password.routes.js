import express from "express";
import passwordController from "../controllers/password.controller.js";
import { adminAuth } from "../middleware/adminAuth.js";

const router = express.Router();

router.use(adminAuth);

// POST /api/password/update/:userId
router.post(
  "/update/:userId",
  passwordController.updatePassword.bind(passwordController)
);

// POST /api/password/reset/:userId
router.post(
  "/reset/:userId",
  passwordController.resetPassword.bind(passwordController)
);

export default router;
