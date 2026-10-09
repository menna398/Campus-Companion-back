import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { publicUser } from "../services/authService.js";
import User from "../models/User.js";
import {
  Course,
  Assignment,
  Exam,
  ScheduleItem,
  Note,
  Event,
} from "../models/resources.js";

const router = Router();
router.use(protect);

// GET /api/profile
router.get("/", (req, res) => res.json({ user: publicUser(req.user) }));

// PATCH /api/profile
router.patch("/", async (req, res, next) => {
  try {
    const allowed = [
      "fullName",
      "email",
      "studentId",
      "university",
      "college",
      "gpa",
      "avatarUrl",
    ];

    const updates = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] =
          typeof req.body[key] === "string"
            ? req.body[key].trim()
            : req.body[key];
      }
    }

    if (updates.fullName === "") {
      return res.status(400).json({ message: "Full name is required." });
    }

    if (updates.studentId === "") {
      return res.status(400).json({ message: "Student ID is required." });
    }

    if (updates.university === "") {
      return res.status(400).json({ message: "University is required." });
    }

    // GPA is optional, but if provided it must be a valid number.
    if (updates.gpa !== undefined && updates.gpa !== "") {
      const gpaNumber = Number(updates.gpa);

      if (Number.isNaN(gpaNumber) || gpaNumber < 0) {
        return res.status(400).json({ message: "GPA must be a valid number." });
      }
    }

    // Email must stay unique.
    if (updates.email !== undefined) {
      if (updates.email === "") {
        return res.status(400).json({ message: "Email is required." });
      }

      updates.email = updates.email.toLowerCase();

      const emailTaken = await User.findOne({
        email: updates.email,
        _id: { $ne: req.user._id },
      });

      if (emailTaken) {
        return res
          .status(409)
          .json({ message: "This email is already registered." });
      }
    }

    Object.assign(req.user, updates);

    await req.user.save();

    res.json({ user: publicUser(req.user) });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/profile
router.delete("/", async (req, res, next) => {
  try {
    const ownerFilter = { owner: req.user._id };

    // Remove everything this user owns, then the account itself.
    await Promise.all([
      Course.deleteMany(ownerFilter),
      Assignment.deleteMany(ownerFilter),
      Exam.deleteMany(ownerFilter),
      ScheduleItem.deleteMany(ownerFilter),
      Note.deleteMany(ownerFilter),
      Event.deleteMany(ownerFilter),
    ]);

    await User.findByIdAndDelete(req.user._id);

    res.json({ message: "Account deleted successfully." });
  } catch (error) {
    next(error);
  }
});

export default router;
