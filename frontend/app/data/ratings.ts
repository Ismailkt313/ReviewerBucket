export type ReviewerRating = {
  id: string;
  reviewerId: string;
  value: number;
  createdAt: string;
  updatedAt: string;
};

export const ratings: ReviewerRating[] = [
  {
    id: "rate-1",
    reviewerId: "test-reviewer",
    value: 5,
    createdAt: "2026-07-01T10:00:00Z",
    updatedAt: "2026-07-01T10:00:00Z"
  },
  {
    id: "rate-2",
    reviewerId: "test-reviewer",
    value: 4,
    createdAt: "2026-06-15T09:30:00Z",
    updatedAt: "2026-06-15T09:30:00Z"
  },
  {
    id: "rate-3",
    reviewerId: "test-reviewer",
    value: 4,
    createdAt: "2026-05-10T14:15:00Z",
    updatedAt: "2026-05-10T14:15:00Z"
  }
];
