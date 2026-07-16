import { Schema, model } from "mongoose";
import type { IReviewerDoc } from "./reviewer.types";

const reviewerSchema = new Schema<IReviewerDoc>(
  {
    name: {
      type: String,
      required: false,
      default: "",
      trim: true,
      maxlength: 100
    },
    code: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true
    },
    stacks: {
      type: [String],
      default: [],
      set: (val: unknown) => {
        if (!Array.isArray(val)) return [];
        return val.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
      }
    }
  },
  {
    timestamps: true
  }
);

export const ReviewerModel = model<IReviewerDoc>("Reviewer", reviewerSchema);
