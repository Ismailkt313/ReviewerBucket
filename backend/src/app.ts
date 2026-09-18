import express from "express";
import cors from "cors";
import helmet from "helmet";
import { corsOptions } from "./config/cors.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware";
import { errorMiddleware } from "./middleware/error.middleware";
import reviewerRoutes from "./modules/reviewers/reviewer.routes";
import ratingRoutes from "./modules/ratings/rating.routes";
import experienceRoutes from "./modules/experiences/experience.routes";
import notificationRoutes from "./modules/notifications/notification.routes.js";
import communityRoutes from "./modules/community/community.routes.js";
import privateRoomRoutes from "./modules/private-rooms/private-room.routes.js";
import privateMessageRoutes from "./modules/private-messages/private-message.routes.js";
import privateContactRoutes from "./modules/private-contacts/private-contact.routes.js";
import adminAuthRoutes from "./modules/admin-auth/admin-auth.routes.js";
import adminPrivateRoomRoutes from "./modules/private-rooms/admin-private-room.routes.js";
import adminBroadcastRoutes from "./modules/broadcasts/admin-broadcast.routes.js";
import broadcastRoutes from "./modules/broadcasts/broadcast.routes.js";
import path from "node:path";

const app = express();
const uploadsPath = path.resolve(process.cwd(), "uploads");

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors(corsOptions)); 
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(uploadsPath));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Reviewer Bucket API is running"
  });
});

app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/private-rooms", adminPrivateRoomRoutes);
app.use("/api/admin/broadcasts", adminBroadcastRoutes);
app.use("/api/broadcasts", broadcastRoutes);
app.use("/api/reviewers", reviewerRoutes);
app.use("/api/reviewers", ratingRoutes);
app.use("/api/reviewers", experienceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/private-rooms", privateRoomRoutes);
app.use("/api/private-rooms", privateMessageRoutes);
app.use("/api/private-contacts", privateContactRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app; 
