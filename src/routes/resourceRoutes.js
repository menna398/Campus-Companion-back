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

const resources = {
  courses: { model: Course, global: false },
  assignments: { model: Assignment, global: false },
  exams: { model: Exam, global: false },
  schedule: { model: ScheduleItem, global: false },
  notes: { model: Note, global: false },
  events: { model: Event, global: true },
};

function getResource(req, res, next) {
  const resource = resources[req.params.resource];

  if (!resource) {
    return res.status(404).json({
      message: "Unknown resource.",
    });
  }

  req.resource = resource;

  next();
}

/*
 * =========================================
 * EXAM HELPERS
 * =========================================
 */

function parseTime(time) {
  if (!time || typeof time !== "string") {
    return null;
  }

  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();

  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    return null;
  }

  if (period === "AM" && hours === 12) {
    hours = 0;
  }

  if (period === "PM" && hours !== 12) {
    hours += 12;
  }

  return hours * 60 + minutes;
}

function parseDurationMinutes(duration) {
  if (!duration || typeof duration !== "string") {
    return null;
  }

  const match = duration.match(/(\d+)\s*(min|mins|minute|minutes)/i);

  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function getExamStartDateTime(examData) {
  if (!examData.examDate || !examData.startTime) {
    return null;
  }

  const timeInMinutes = parseTime(examData.startTime);

  if (timeInMinutes === null) {
    return null;
  }

  const [year, month, day] = examData.examDate.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const hours = Math.floor(timeInMinutes / 60);
  const minutes = timeInMinutes % 60;

  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getExamEndDateTime(examData) {
  const startDateTime = getExamStartDateTime(examData);

  if (!startDateTime) {
    return null;
  }

  const durationMinutes = parseDurationMinutes(examData.duration);

  if (!durationMinutes) {
    return startDateTime;
  }

  return new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);
}

function getExamStatus(examData) {
  const endDateTime = getExamEndDateTime(examData);

  if (!endDateTime) {
    return "UPCOMING";
  }

  const now = new Date();

  if (now >= endDateTime) {
    return "PENDING_GRADE";
  }

  return "UPCOMING";
}

function getExamDisplayData(examData) {
  return {
    ...examData,
    status: getExamStatus(examData),
  };
}

/*
 * =========================================
 * SCHEDULE HELPERS
 * =========================================
 */

/*
 * Course.schedule is the source of truth.
 *
 * Course:
 * {
 *   schedule: {
 *     day,
 *     startTime,
 *     endTime
 *   }
 * }
 *
 * ScheduleItem is only a synced representation.
 */

async function getCourseForSchedule(courseId, userId) {
  if (!courseId) {
    return null;
  }

  return Course.findOne({
    _id: courseId,
    owner: userId,
  });
}

function buildScheduleDisplayData(scheduleData, course) {
  const courseData = course?.data || {};

  return {
    ...scheduleData,

    courseId: scheduleData.courseId || course?._id?.toString() || "",

    courseCode: courseData.code || scheduleData.courseCode || "",

    courseName:
      courseData.title || courseData.name || scheduleData.courseName || "",

    shortTitle: courseData.code || scheduleData.shortTitle || "",

    professor: courseData.professor || scheduleData.professor || "",

    room: courseData.location || scheduleData.room || "",

    color: courseData.color || scheduleData.color || "",

    id: scheduleData.id,
    _id: scheduleData._id,
  };
}

/*
 * Sync Course.schedule -> ScheduleItem
 *
 * Course.schedule is an OBJECT, not an array.
 */

async function syncCourseSchedule(userId, courseDoc) {
  const courseId = courseDoc._id.toString();

  await ScheduleItem.deleteMany({
    owner: userId,
    "data.courseId": courseId,
  });

  const courseData = courseDoc.data || {};
  const schedule = courseData.schedule;

  /*
   * No schedule
   */
  if (
    !schedule ||
    typeof schedule !== "object" ||
    Array.isArray(schedule) ||
    !schedule.day ||
    !schedule.startTime ||
    !schedule.endTime
  ) {
    return [];
  }

  const scheduleItem = {
    owner: userId,
    data: {
      courseId,

      courseCode: courseData.code || "",

      courseName: courseData.title || courseData.name || "",

      shortTitle: courseData.code || "",

      professor: courseData.professor || "",

      room: courseData.location || "",

      color: courseData.color || "",

      day: schedule.day,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    },
  };

  await ScheduleItem.create(scheduleItem);

  return [scheduleItem];
}

/*
 * =========================================
 * READ FILTER
 * =========================================
 */

const readFilter = (req) => {
  const filter = req.resource.global
    ? {
        $or: [{ owner: null }, { owner: req.user._id }],
      }
    : {
        owner: req.user._id,
      };

  if (req.params.resource === "assignments" && req.query.courseId) {
    filter["data.courseId"] = req.query.courseId;
  }

  if (req.params.resource === "exams" && req.query.courseId) {
    filter["data.courseId"] = req.query.courseId;
  }

  if (req.params.resource === "schedule" && req.query.courseId) {
    filter["data.courseId"] = req.query.courseId;
  }

  return filter;
};

/*
 * =========================================
 * WRITE FILTER
 * =========================================
 */

const writeFilter = (req) =>
  req.resource.global
    ? {
        $or: [{ owner: null }, { owner: req.user._id }],
      }
    : {
        owner: req.user._id,
      };
/*
 * =========================================
 * RESOURCE MIDDLEWARE
 * =========================================
 */

router.use("/:resource", getResource);

/*
 * =========================================
 * GET ALL
 * =========================================
 */

router.get("/:resource", async (req, res, next) => {
  try {
    const docs = await req.resource.model
      .find(readFilter(req))
      .sort({ createdAt: 1 });

    /*
     * =====================================
     * EXAMS
     * =====================================
     */

    if (req.params.resource === "exams") {
      const courseIds = [
        ...new Set(
          docs
            .map((doc) => doc.data?.courseId)
            .filter(Boolean)
            .map((id) => id.toString()),
        ),
      ];

      const courses = courseIds.length
        ? await Course.find({
            owner: req.user._id,
            _id: {
              $in: courseIds,
            },
          })
        : [];

      const courseMap = new Map();

      courses.forEach((course) => {
        courseMap.set(course._id.toString(), course.data);
      });

      return res.json({
        data: docs.map((doc) => {
          const examData = doc.data || {};

          const course = examData.courseId
            ? courseMap.get(examData.courseId.toString())
            : null;

          return {
            ...getExamDisplayData(examData),

            courseCode: course?.code || examData.courseCode || "",

            courseName:
              course?.name || course?.title || examData.courseName || "",

            professor: course?.professor || "",

            id: doc._id.toString(),
            _id: doc._id.toString(),
          };
        }),
      });
    }

    /*
     * =====================================
     * SCHEDULE
     * =====================================
     */

    if (req.params.resource === "schedule") {
      const courseIds = [
        ...new Set(
          docs
            .map((doc) => doc.data?.courseId)
            .filter(Boolean)
            .map((id) => id.toString()),
        ),
      ];

      const courses = courseIds.length
        ? await Course.find({
            owner: req.user._id,
            _id: {
              $in: courseIds,
            },
          })
        : [];

      const courseMap = new Map();

      courses.forEach((course) => {
        courseMap.set(course._id.toString(), course);
      });

      return res.json({
        data: docs.map((doc) => {
          const scheduleData = doc.data || {};

          const course = scheduleData.courseId
            ? courseMap.get(scheduleData.courseId.toString())
            : null;

          return buildScheduleDisplayData(
            {
              ...scheduleData,
              id: doc._id.toString(),
              _id: doc._id.toString(),
            },
            course,
          );
        }),
      });
    }

    /*
     * =====================================
     * OTHER RESOURCES
     * =====================================
     */

    return res.json({
      data: docs.map((doc) => ({
        ...doc.data,
        id: doc._id.toString(),
        _id: doc._id.toString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

/*
 * =========================================
 * GET ONE
 * =========================================
 */

router.get("/:resource/:id", async (req, res, next) => {
  try {
    const filter = {
      _id: req.params.id,
      ...readFilter(req),
    };

    const doc = await req.resource.model.findOne(filter);

    if (!doc) {
      return res.status(404).json({
        message: "Item not found.",
      });
    }

    /*
     * =====================================
     * EXAM
     * =====================================
     */

    if (req.params.resource === "exams") {
      const examData = doc.data || {};

      const course = examData.courseId
        ? await Course.findOne({
            _id: examData.courseId,
            owner: req.user._id,
          })
        : null;

      return res.json({
        data: {
          ...getExamDisplayData(examData),

          courseCode: course?.data?.code || examData.courseCode || "",

          courseName:
            course?.data?.name ||
            course?.data?.title ||
            examData.courseName ||
            "",

          professor: course?.data?.professor || "",

          id: doc._id.toString(),
          _id: doc._id.toString(),
        },
      });
    }

    /*
     * =====================================
     * SCHEDULE
     * =====================================
     */

    if (req.params.resource === "schedule") {
      const scheduleData = doc.data || {};

      const course = scheduleData.courseId
        ? await getCourseForSchedule(scheduleData.courseId, req.user._id)
        : null;

      return res.json({
        data: buildScheduleDisplayData(
          {
            ...scheduleData,
            id: doc._id.toString(),
            _id: doc._id.toString(),
          },
          course,
        ),
      });
    }

    /*
     * =====================================
     * OTHER RESOURCES
     * =====================================
     */

    return res.json({
      data: {
        ...doc.data,
        id: doc._id.toString(),
        _id: doc._id.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/*
 * =========================================
 * POST
 * =========================================
 */

router.post("/:resource", async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        message: "Request body must be an object.",
      });
    }

    const { id: _id, _id: ignoredId, ...data } = req.body;

    /*
     * =====================================
     * COURSE
     * =====================================
     */

    if (req.params.resource === "courses") {
      const doc = await req.resource.model.create({
        owner: req.user._id,
        data,
      });

      await syncCourseSchedule(req.user._id, doc);

      return res.status(201).json({
        data: {
          ...doc.data,
          id: doc._id.toString(),
          _id: doc._id.toString(),
        },
      });
    }

    /*
     * =====================================
     * ASSIGNMENT
     * =====================================
     */

    if (req.params.resource === "assignments") {
      if (!data.courseId) {
        return res.status(400).json({
          message: "courseId is required for an assignment.",
        });
      }

      const course = await Course.findOne({
        _id: data.courseId,
        owner: req.user._id,
      });

      if (!course) {
        return res.status(404).json({
          message: "Course not found.",
        });
      }

      data.courseCode = course.data?.code || "";
    }

    /*
     * =====================================
     * EXAM
     * =====================================
     */

    if (req.params.resource === "exams") {
      if (!data.courseId) {
        return res.status(400).json({
          message: "courseId is required for an exam.",
        });
      }

      const course = await Course.findOne({
        _id: data.courseId,
        owner: req.user._id,
      });

      if (!course) {
        return res.status(404).json({
          message: "Course not found.",
        });
      }

      data.courseCode = course.data?.code || "";

      data.courseName =
        course.data?.name || course.data?.title || data.courseName || "";

      delete data.location;
      delete data.professor;
    }

    /*
     * =====================================
     * SCHEDULE
     * =====================================
     */

    if (req.params.resource === "schedule") {
      return res.status(400).json({
        message: "Schedule is managed through Course.schedule.",
      });
    }

    const doc = await req.resource.model.create({
      owner: req.user._id,
      data,
    });

    /*
     * =====================================
     * EXAM RESPONSE
     * =====================================
     */

    if (req.params.resource === "exams") {
      const course = await Course.findOne({
        _id: doc.data.courseId,
        owner: req.user._id,
      });

      return res.status(201).json({
        data: {
          ...getExamDisplayData(doc.data),

          courseCode: course?.data?.code || doc.data.courseCode || "",

          courseName:
            course?.data?.name ||
            course?.data?.title ||
            doc.data.courseName ||
            "",

          professor: course?.data?.professor || "",

          id: doc._id.toString(),
          _id: doc._id.toString(),
        },
      });
    }

    return res.status(201).json({
      data: {
        ...doc.data,
        id: doc._id.toString(),
        _id: doc._id.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/*
 * =========================================
 * PUT
 * =========================================
 */

router.put("/:resource/:id", async (req, res, next) => {
  try {
    const doc = await req.resource.model.findOne({
      _id: req.params.id,
      ...writeFilter(req),
    });

    if (!doc) {
      return res.status(404).json({
        message: "Item not found or is read-only.",
      });
    }

    const { id: _id, _id: ignoredId, ...data } = req.body;

    /*
     * =====================================
     * SCHEDULE
     * =====================================
     */

    if (req.params.resource === "schedule") {
      return res.status(400).json({
        message: "Schedule is managed through Course.schedule.",
      });
    }

    /*
     * =====================================
     * COURSE
     * =====================================
     */

    if (req.params.resource === "courses") {
      doc.data = {
        ...doc.data,
        ...data,
      };

      await doc.save();

      await syncCourseSchedule(req.user._id, doc);

      return res.json({
        data: {
          ...doc.data,
          id: doc._id.toString(),
          _id: doc._id.toString(),
        },
      });
    }

    /*
     * =====================================
     * ASSIGNMENT
     * =====================================
     */

    if (req.params.resource === "assignments" && data.courseId) {
      const course = await Course.findOne({
        _id: data.courseId,
        owner: req.user._id,
      });

      if (!course) {
        return res.status(404).json({
          message: "Course not found.",
        });
      }

      data.courseCode = course.data?.code || "";
    }

    /*
     * =====================================
     * EXAM
     * =====================================
     */

    if (req.params.resource === "exams") {
      let course = null;

      if (data.courseId) {
        course = await Course.findOne({
          _id: data.courseId,
          owner: req.user._id,
        });

        if (!course) {
          return res.status(404).json({
            message: "Course not found.",
          });
        }
      } else if (doc.data?.courseId) {
        course = await Course.findOne({
          _id: doc.data.courseId,
          owner: req.user._id,
        });
      }

      if (course) {
        data.courseCode = course.data?.code || "";

        data.courseName =
          course.data?.name ||
          course.data?.title ||
          data.courseName ||
          doc.data?.courseName ||
          "";
      }

      delete data.location;
      delete data.professor;
    }

    doc.data = {
      ...doc.data,
      ...data,
    };

    await doc.save();

    /*
     * =====================================
     * EXAM RESPONSE
     * =====================================
     */

    if (req.params.resource === "exams") {
      const course = await Course.findOne({
        _id: doc.data.courseId,
        owner: req.user._id,
      });

      return res.json({
        data: {
          ...getExamDisplayData(doc.data),

          courseCode: course?.data?.code || doc.data.courseCode || "",

          courseName:
            course?.data?.name ||
            course?.data?.title ||
            doc.data.courseName ||
            "",

          professor: course?.data?.professor || "",

          id: doc._id.toString(),
          _id: doc._id.toString(),
        },
      });
    }

    return res.json({
      data: {
        ...doc.data,
        id: doc._id.toString(),
        _id: doc._id.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/*
 * =========================================
 * DELETE
 * =========================================
 */

router.delete("/:resource/:id", async (req, res, next) => {
  try {
    /*
     * Schedule is managed through Course.schedule.
     */

    if (req.params.resource === "schedule") {
      return res.status(400).json({
        message: "Schedule is managed through Course.schedule.",
      });
    }

    const doc = await req.resource.model.findOneAndDelete({
      _id: req.params.id,
      ...writeFilter(req),
    });

    if (!doc) {
      return res.status(404).json({
        message: "Item not found or is read-only.",
      });
    }

    /*
     * =====================================
     * COURSE CASCADE DELETE
     * =====================================
     */

    if (req.params.resource === "courses") {
      await Assignment.deleteMany({
        owner: req.user._id,
        "data.courseId": req.params.id,
      });

      await Exam.deleteMany({
        owner: req.user._id,
        "data.courseId": req.params.id,
      });

      await ScheduleItem.deleteMany({
        owner: req.user._id,
        "data.courseId": req.params.id,
      });
    }

    res.json({
      message: "Item deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
