import { Router } from 'express';
import {
  getHealthController,
  getStreamController,
  enqueueStreamController,
  retryStreamController,
  rerenderLotController,
  triggerDiscoveryController,
  fetchAuctionDataController,
} from '../controller';
import { verifyJwtMiddleware } from '../middlewares/verifyJwt.middleware';

const router = Router();

// Public health check route for load balancers / autohealing
router.get('/health', getHealthController);

// Protected Admin API routes
router.get('/streams/:id', verifyJwtMiddleware, getStreamController);
router.post('/enqueue', verifyJwtMiddleware, enqueueStreamController);
router.post('/retry', verifyJwtMiddleware, retryStreamController);
router.post('/rerender', verifyJwtMiddleware, rerenderLotController);
router.post('/cron/discovery', verifyJwtMiddleware, triggerDiscoveryController);

// Fetch auction data from share-leaderboard & update Firestore
router.post('/auction/fetch', verifyJwtMiddleware, fetchAuctionDataController);
router.post('/auctions/fetch', verifyJwtMiddleware, fetchAuctionDataController);
router.post('/auction/sync', verifyJwtMiddleware, fetchAuctionDataController);
router.post('/auctions/sync', verifyJwtMiddleware, fetchAuctionDataController);
router.post('/streams/:id/auctions', verifyJwtMiddleware, fetchAuctionDataController);
router.post('/streams/:id/fetch-auctions', verifyJwtMiddleware, fetchAuctionDataController);

export default router;
