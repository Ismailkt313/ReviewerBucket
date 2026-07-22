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
      trim: true
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true
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

reviewerSchema.index({ name: 1 });
reviewerSchema.index({ slug: 1, status: 1 });
reviewerSchema.index({ code: 1, status: 1 });
reviewerSchema.index({ status: 1, name: 1 });

export const ReviewerModel = model<IReviewerDoc>("Reviewer", reviewerSchema);
