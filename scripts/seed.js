import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import { Event } from "../src/models/resources.js";
import { eventsData } from "../src/data/events.js";
import { replacePersonalSeedData } from "../src/services/resourceSeedService.js";

const DEMO_USER = {
  fullName: process.env.SEED_FULL_NAME || "Menna Khaled",
  email: (process.env.SEED_EMAIL || "menna@campuscompanion.test").toLowerCase(),
  studentId: process.env.SEED_STUDENT_ID || "CC-2026-001",
  university: process.env.SEED_UNIVERSITY || "Campus University",
  password: process.env.SEED_PASSWORD || "123456",
};

try {
  await mongoose.connect(process.env.MONGODB_URI);

  let user = await User.findOne({ email: DEMO_USER.email });

  if (!user) {
    user = await User.create({
      fullName: DEMO_USER.fullName,
      email: DEMO_USER.email,
      studentId: DEMO_USER.studentId,
      university: DEMO_USER.university,
      passwordHash: await bcrypt.hash(DEMO_USER.password, 12),
    });
  } else {
    user.fullName = DEMO_USER.fullName;
    user.studentId = DEMO_USER.studentId;
    user.university = DEMO_USER.university;
    user.passwordHash = await bcrypt.hash(DEMO_USER.password, 12);
    await user.save();
  }

  const personalSummary = await replacePersonalSeedData(user._id);

  // Campus events are shared across students.
  // Re-seeding replaces only the global event records (owner: null).
  await Event.deleteMany({ owner: null });
  await Event.insertMany(
    eventsData.map(({ id, _id, ...data }) => ({
      owner: null,
      data,
    }))
  );

  console.log("\nCampus Companion seed completed successfully.\n");
  console.log(`Demo user: ${DEMO_USER.email}`);
  console.log(`Demo password: ${DEMO_USER.password}`);
  console.log("\nPersonal data seeded:");
  console.table(personalSummary);
  console.log(`Global events seeded: ${eventsData.length}`);
} catch (error) {
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
