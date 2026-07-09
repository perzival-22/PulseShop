import { Router } from 'express';
import { getMerchantProfile, getMerchantInventory, onboardMerchant, addProduct } from './merchant.controller';
import { requireMerchantAuth } from '../../middleware/auth.guard';

const router = Router();

router.use(requireMerchantAuth);

router.post('/onboard', onboardMerchant);
router.get('/profile', getMerchantProfile);
router.get('/inventory', getMerchantInventory);
router.post('/products', addProduct);

export default router;