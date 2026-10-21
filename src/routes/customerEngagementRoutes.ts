import { Router } from "express";
import {
  addPropertyComment,
  getEngagementSummary,
  getPropertyComments,
  likeProperty,
  recordPropertyView,
  recordVideoView,
  unlikeProperty,
} from "../controllers/customerEngagementController";
import {
  requireAuth,
  requireCustomer,
} from "../middleware/authMiddleware";

const router = Router();

router.use(requireAuth, requireCustomer);

router.get("/:propertyId/summary", getEngagementSummary);
router.post("/:propertyId/like", likeProperty);
router.delete("/:propertyId/like", unlikeProperty);
router.get("/:propertyId/comments", getPropertyComments);
router.post("/:propertyId/comments", addPropertyComment);
router.post("/:propertyId/view", recordPropertyView);
router.post("/:propertyId/video-view", recordVideoView);

export default router;
