import { Router } from "express";
import { protect } from "../middleware/auth.js";
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

const serialize = (doc) => ({
  ...doc.data,
  id: doc._id.toString(),
  _id: doc._id.toString(),
});

router.get("/", async (req, res, next) => {
  try {
    const [courses, assignments, exams, schedule, notes, events] =
      await Promise.all([
        Course.find({ owner: req.user._id }).sort({ createdAt: 1 }),
        Assignment.find({ owner: req.user._id }).sort({ createdAt: 1 }),
        Exam.find({ owner: req.user._id }).sort({ createdAt: 1 }),
        ScheduleItem.find({ owner: req.user._id }).sort({ createdAt: 1 }),
        Note.find({ owner: req.user._id }).sort({ createdAt: 1 }),
        Event.find({
          $or: [{ owner: null }, { owner: req.user._id }],
        }).sort({ createdAt: 1 }),
      ]);

    res.json({
      data: {
        courses: courses.map(serialize),
        assignments: assignments.map(serialize),
        exams: exams.map(serialize),
        schedule: schedule.map(serialize),
        notes: notes.map(serialize),
        events: events.map(serialize),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
