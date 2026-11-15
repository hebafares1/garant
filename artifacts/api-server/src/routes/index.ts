import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import healthRouter from "./health";
import merchantRouter from "./merchant";
import publicOrdersRouter from "./public-orders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(merchantRouter);
router.use(publicOrdersRouter);
router.use(adminRouter);

export default router;
