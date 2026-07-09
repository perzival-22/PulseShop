import { Router } from 'express';
import { getOrders, updateOrderStatus } from './order.controller';
import { requireMerchantAuth } from '../../middleware/auth.guard';

const router = Router();

router.use(requireMerchantAuth);

router.get('/', getOrders);
router.patch('/:id/status', updateOrderStatus);

export default router;