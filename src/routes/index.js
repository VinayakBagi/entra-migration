import express from "express";
import migrationRoutes from "./migration.routes.js";
import authRoutes from "./auth.routes.js";
import passwordRoutes from "./password.routes.js";
import dummyUserRoutes from "./dummy-user.routes.js";
import nativeAuthRoutes from "./nativeAuthRoutes.js";
import emailRoutes from "./email.routes.js";
const router = express.Router();

router.use("/migration", migrationRoutes);
router.use("/auth", authRoutes);
router.use("/password", passwordRoutes);
router.use("/", dummyUserRoutes);
router.use("/sspr", nativeAuthRoutes);
router.use("/email", emailRoutes);

export default router;
