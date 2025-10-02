import express from "express";
import migrationController from "../controllers/migration.controller.js";
import { adminAuth } from "../middleware/adminAuth.js";

const router = express.Router();

router.use(adminAuth);

// GET /api/migration/status
router.get("/status", migrationController.getStatus);

// GET /api/migration/progress
router.get("/progress", migrationController.getProgress);

// POST /api/migration/start
router.post("/start", migrationController.startBulkMigration);

// POST /api/migration/user/:userId
router.post("/user/:userId", migrationController.migrateSingleUser);

export default router;
