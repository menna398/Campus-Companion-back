import { courses } from "./courses.js";
import { assignments } from "./assignments.js";
import { eventsData } from "./events.js";
import { upcomingExams, pastExams } from "./exams.js";
import { notes } from "./notes.js";

export const demoSeed = {
  courses,
  assignments,
  exams: [...upcomingExams, ...pastExams],
  schedule: [],
  notes,
  events: eventsData,
};
