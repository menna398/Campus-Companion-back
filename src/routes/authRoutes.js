import { Router } from "express";
import { login, register, publicUser } from "../services/authService.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.post("/register", async (req, res, next) => {
  try {
    const { fullName, email, studentId, university, password } = req.body;
    if (![fullName, email, studentId, university, password].every((v) => typeof v === "string" && v.trim())) {
      return res.status(400).json({ message: "fullName, email, studentId, university and password are required." });
    }
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });
    res.status(201).json(await register({ fullName: fullName.trim(), email: email.trim(), studentId: studentId.trim(), university: university.trim(), password }));
  } catch (error) { next(error); }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }
    res.json(await login({ email: email.trim(), password }));
  } catch (error) { next(error); }
});

router.get("/me", protect, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
