import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { Course } from "../models/resources.js";
import { replacePersonalSeedData } from "./resourceSeedService.js";

const publicUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  studentId: user.studentId,
  university: user.university,
  college: user.college || "",
  gpa: user.gpa || "",
  avatarUrl: user.avatarUrl,
});

const makeToken = (user) =>
  jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

export async function register({
  fullName,
  email,
  studentId,
  university,
  password,
}) {
  const existing = await User.findOne({ email: email.toLowerCase() });

  if (existing) {
    const error = new Error("This email is already registered.");
    error.status = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.create({
    fullName,
    email: email.toLowerCase(),
    studentId,
    university,
    passwordHash,
  });

  // Give a newly registered student the same demo/starter academic data
  // so the UI is populated immediately during development.
  await replacePersonalSeedData(user._id);

  return { user: publicUser(user), token: makeToken(user) };
}

export async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+passwordHash",
  );

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const error = new Error("Invalid email or password.");
    error.status = 401;
    throw error;
  }

  // Development convenience: if this is an existing account created before
  // the backend was connected, give it the starter data once so the pages
  // are populated instead of returning empty arrays.
  const courseCount = await Course.countDocuments({ owner: user._id });

  if (courseCount === 0) {
    await replacePersonalSeedData(user._id);
  }

  return { user: publicUser(user), token: makeToken(user) };
}

export { publicUser };
