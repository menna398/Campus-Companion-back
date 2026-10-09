import { Router } from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import { Course, Assignment, Exam, ScheduleItem, Note, Event } from "../models/resources.js";

const router = Router();
router.use(protect);

router.get("/data-status", async (req, res, next) => {
  try {
    const [user, courses, assignments, exams, schedule, notes, events] = await Promise.all([
      User.findById(req.user._id).select("fullName email studentId university"),
      Course.countDocuments({ owner: req.user._id }),
      Assignment.countDocuments({ owner: req.user._id }),
      Exam.countDocuments({ owner: req.user._id }),
      ScheduleItem.countDocuments({ owner: req.user._id }),
      Note.countDocuments({ owner: req.user._id }),
      Event.countDocuments({ $or: [{ owner: null }, { owner: req.user._id }] }),
    ]);

    res.json({
      user,
      counts: { courses, assignments, exams, schedule, notes, events },
      message:
        courses || assignments || exams || schedule || notes || events
          ? "Data is available for this authenticated user."
          : "No data is associated with this authenticated user yet.",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
