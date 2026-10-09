import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    studentId: { type: String, required: true, trim: true },
    university: { type: String, required: true, trim: true },
    college: { type: String, default: "", trim: true },
    gpa: { type: String, default: "", trim: true },
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String, default: "" },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
