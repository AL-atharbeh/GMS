import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
const router = Router();
router.use(authenticate);
router.get('/', (req, res) => res.json({ success: true, message: 'Module: super-admin' }));
export default router;
