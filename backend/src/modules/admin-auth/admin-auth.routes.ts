import { Router } from "express";
import { loginAdmin } from "./admin-auth.controller.js";
import { validateAdminLogin } from "./admin-auth.validation.js";

const router = Router();

router.post("/login", validateAdminLogin, loginAdmin);

export default router;
