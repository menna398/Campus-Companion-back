export function buildScheduleFromCourses(courseDocs) {
  const scheduleItems = [];

  courseDocs.forEach((courseDoc) => {
    const course = courseDoc.data || {};
    const courseId = courseDoc._id.toString();

    if (!Array.isArray(course.schedule)) {
      return;
    }

    course.schedule.forEach((slot) => {
      if (!slot?.day || !slot?.startTime || !slot?.endTime) {
        return;
      }

      scheduleItems.push({
        courseId,
        courseCode: course.code || "",
        courseName: course.title || course.name || "",
        shortTitle: course.code || "",
        professor: course.professor || "",
        room: course.location || "",
        color: course.color || "",
        day: slot.day,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
    });
  });

  return scheduleItems;
}

export const initialSchedule = [];
