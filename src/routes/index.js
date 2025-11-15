import express from "express";
import migrationRoutes from "./migration.routes.js";
import authRoutes from "./auth.routes.js";
import passwordRoutes from "./password.routes.js";
import dummyUserRoutes from "./dummy-user.routes.js";

const router = express.Router();

router.use("/migration", migrationRoutes);
router.use("/auth", authRoutes);
router.use("/password", passwordRoutes);
router.use("/", dummyUserRoutes);

export default router;
