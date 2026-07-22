import { getIO } from "./socket.js";

export class ReviewerBroadcaster {
  static broadcastReviewerApproved(reviewer: {
    id: string;
    name: string;
    code: string;
    slug: string;
    stacks: string[];
    stats?: any;
  }): void {
    const io = getIO();
    if (!io) return;
    io.emit("reviewer:approved", { reviewer });
  }

  static broadcastReviewerUpdated(reviewer: {
    id: string;
    name: string;
    code: string;
    slug: string;
    stacks: string[];
    stats?: any;
  }): void {
    const io = getIO();
    if (!io) return;
    io.emit("reviewer:updated", { reviewer });
  }

  static broadcastReviewerStatsUpdated(reviewerId: string, stats: any): void {
    const io = getIO();
    if (!io) return;
    io.emit("reviewer:stats:updated", { reviewerId, stats });
  }
}
