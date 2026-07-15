export type StudentExperience = {
  id: string;
  reviewerId: string;
  content: string;
  status: "approved" | "pending" | "rejected";
  createdAt: string;
};

export const experiences: StudentExperience[] = [
  {
    id: "exp-1",
    reviewerId: "test-reviewer",
    content: "The review focused on React state management and custom hooks. The communication was polite, and the feedback about structuring useEffect was very detailed and helpful.",
    status: "approved",
    createdAt: "2026-07-01T10:00:00Z"
  },
  {
    id: "exp-2",
    reviewerId: "test-reviewer",
    content: "Conducted a Node.js and Express API architecture review. Very clear explanations on database connection optimization. Suggested separating routes from controllers, which was highly useful.",
    status: "approved",
    createdAt: "2026-06-15T09:30:00Z"
  },
  {
    id: "exp-3",
    reviewerId: "test-reviewer",
    content: "Went through JavaScript fundamentals, prototype chain, and event loop. Although the reviewer gave constructive pointers on scoping, the explanation on closures felt slightly fast but still easy to follow.",
    status: "approved",
    createdAt: "2026-05-10T14:15:00Z"
  },
  {
    id: "exp-4",
    reviewerId: "test-reviewer",
    content: "This experience is pending and should not be displayed in the summary or list of student experiences.",
    status: "pending",
    createdAt: "2026-07-02T12:00:00Z"
  },
  {
    id: "exp-5",
    reviewerId: "test-reviewer",
    content: "This experience is rejected and should not be displayed in the summary or list of student experiences.",
    status: "rejected",
    createdAt: "2026-07-03T12:00:00Z"
  }
];
