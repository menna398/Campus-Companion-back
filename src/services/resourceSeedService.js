import {
  Course,
  Assignment,
  Exam,
  ScheduleItem,
  Note,
} from "../models/resources.js";

import { demoSeed } from "../data/seedData.js";
import { buildScheduleFromCourses } from "../data/schedule.js";

const personalModels = {
  courses: Course,
  assignments: Assignment,
  exams: Exam,
  schedule: ScheduleItem,
  notes: Note,
};

export async function replacePersonalSeedData(userId) {
  const summary = {};

  /*
   * =========================================
   * COURSES
   * =========================================
   */

  await Course.deleteMany({ owner: userId });

  const courseSeedData = demoSeed.courses || [];

  const coursesToInsert = courseSeedData.map(
    ({ id, _id, assignments, ...courseData }) => ({
      owner: userId,
      data: {
        ...courseData,
        schedule: courseData.schedule || null,
      },
    }),
  );

  const insertedCourses = coursesToInsert.length
    ? await Course.insertMany(coursesToInsert)
    : [];

  summary.courses = insertedCourses.length;

  /*
   * =========================================
   * COURSE LOOKUP
   * =========================================
   *
   * courseCode -> real MongoDB courseId
   */

  const courseIdByCode = new Map();

  insertedCourses.forEach((courseDoc) => {
    const courseCode = courseDoc.data?.code;

    if (courseCode) {
      courseIdByCode.set(courseCode, courseDoc._id.toString());
    }
  });

  /*
   * =========================================
   * SCHEDULE
   * =========================================
   *
   * Schedule is generated from Course.schedule.
   *
   * Course is the source of truth.
   */

  await ScheduleItem.deleteMany({
    owner: userId,
  });

  const scheduleItems = buildScheduleFromCourses(insertedCourses);

  if (scheduleItems.length) {
    await ScheduleItem.insertMany(
      scheduleItems.map((item) => ({
        owner: userId,
        data: item,
      })),
    );
  }

  summary.schedule = scheduleItems.length;

  /*
   * =========================================
   * ASSIGNMENTS
   * =========================================
   */

  await Assignment.deleteMany({ owner: userId });

  const assignmentSeedData = demoSeed.assignments || [];

  const assignmentsToInsert = assignmentSeedData.map(
    ({ id, _id, courseId, ...assignmentData }) => {
      const resolvedCourseId =
        courseId || courseIdByCode.get(assignmentData.courseCode) || null;

      return {
        owner: userId,

        data: {
          ...assignmentData,
          courseId: resolvedCourseId,
        },
      };
    },
  );

  if (assignmentsToInsert.length) {
    await Assignment.insertMany(assignmentsToInsert);
  }

  summary.assignments = assignmentsToInsert.length;

  /*
   * =========================================
   * EXAMS
   * =========================================
   *
   * Exam stores:
   *
   * - examDate
   * - startTime
   * - type
   * - courseCode
   * - courseName
   * - duration
   * - courseId
   *
   * Exam grades are NOT merged into
   * Course.grades.
   */

  await Exam.deleteMany({ owner: userId });

  const examSeedData = demoSeed.exams || [];

  const examsToInsert = examSeedData
    .map(({ id, _id, courseId, ...examData }) => {
      const resolvedCourseId =
        courseId || courseIdByCode.get(examData.courseCode) || null;

      if (!resolvedCourseId) {
        return null;
      }

      return {
        owner: userId,

        data: {
          ...examData,
          courseId: resolvedCourseId,
        },
      };
    })
    .filter(Boolean);

  if (examsToInsert.length) {
    await Exam.insertMany(examsToInsert);
  }

  summary.exams = examsToInsert.length;

  /*
   * =========================================
   * NOTES
   * =========================================
   */

  await Note.deleteMany({
    owner: userId,
  });

  const noteItems = demoSeed.notes || [];

  if (noteItems.length) {
    await Note.insertMany(
      noteItems.map(({ id, _id, ...data }) => ({
        owner: userId,
        data,
      })),
    );
  }

  summary.notes = noteItems.length;

  return summary;
}
