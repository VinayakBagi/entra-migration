import express from "express";
import migrationRoutes from "./migration.routes.js";
import authRoutes from "./auth.routes.js";

const router = express.Router();

router.use("/migration", migrationRoutes);
router.use("/auth", authRoutes);

export default router;
