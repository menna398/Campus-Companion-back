import mongoose from "mongoose";

export function createResourceModel(modelName) {
  if (mongoose.models[modelName]) return mongoose.models[modelName];

  const schema = new mongoose.Schema(
    {
      owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
      // Mixed fields preserve the shape of the existing frontend mock objects.
      data: { type: mongoose.Schema.Types.Mixed, required: true }
    },
    { timestamps: true, minimize: false }
  );

  return mongoose.model(modelName, schema);
}
