import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { Course, Assignment, Exam, ScheduleItem, Note, Event } from "../models/resources.js";

const router = Router();
router.use(protect);

const models = {
  courses: Course,
  assignments: Assignment,
  exams: Exam,
  schedule: ScheduleItem,
  notes: Note,
  events: Event
};

// Imports a JSON export from the old localStorage-backed frontend into MongoDB.
// The payload shape is { courses: [], assignments: [], ... }.
router.post("/import", async (req, res, next) => {
  try {
    const summary = {};
    for (const [key, Model] of Object.entries(models)) {
      const items = req.body[key];
      if (items === undefined) continue;
      if (!Array.isArray(items)) return res.status(400).json({ message: `${key} must be an array.` });
      await Model.deleteMany({ owner: req.user._id });
      if (items.length) {
        await Model.insertMany(items.map(({ _id, ...data }) => ({ owner: req.user._id, data })));
      }
      summary[key] = items.length;
    }
    res.json({ message: "Import completed.", imported: summary });
  } catch (error) { next(error); }
});

export default router;
