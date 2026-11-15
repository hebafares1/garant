import { randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  ConfirmOrderReceivedBody,
  ConfirmOrderReceivedParams,
  ConfirmOrderReceivedResponse,
  GetPublicOrderParams,
  GetPublicOrderResponse,
  SimulatePaymentBody,
  SimulatePaymentParams,
  SimulatePaymentResponse,
  SubmitDisputeBody,
  SubmitDisputeParams,
  SubmitDisputeResponse,
  VerifyBuyerOtpBody,
  VerifyBuyerOtpParams,
  VerifyBuyerOtpResponse,
} from "@workspace/api-zod";
import {
  db,
  disputesTable,
  merchantsTable,
  notificationsTable,
  ordersTable,
  paymentsTable,
} from "@workspace/db";
import {
  addSimulatedNotification,
  disputeResponse,
  orderResponse,
  releaseExpiredOrders,
} from "../lib/garant";

const router: IRouter = Router();
const DEMO_OTP = "123456";

async function getOrderByToken(token: string) {
  const [row] = await db
    .select({ order: ordersTable, merchant: merchantsTable })
    .from(ordersTable)
    .innerJoin(merchantsTable, eq(ordersTable.merchantId, merchantsTable.id))
    .where(eq(ordersTable.token, token))
    .limit(1);
  return row;
}

router.get(
  "/garant/public/orders/:token",
  async (req, res): Promise<void> => {
    await releaseExpiredOrders();
    const params = GetPublicOrderParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const row = await getOrderByToken(params.data.token);
    if (!row) {
      res.status(404).json({ error: "Payment link not found." });
      return;
    }
    res.json(
      GetPublicOrderResponse.parse(orderResponse(row.order, row.merchant)),
    );
  },
);

router.post(
  "/garant/public/orders/:token/pay",
  async (req, res): Promise<void> => {
    const params = SimulatePaymentParams.safeParse(req.params);
    const body = SimulatePaymentBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!body.success) {
      res.status(400).json({
        error: body.error.message,
      });
      return;
    }
    const row = await getOrderByToken(params.data.token);
    if (!row) {
      res.status(404).json({ error: "Payment link not found." });
      return;
    }
    if (row.order.status !== "CREATED") {
      res.status(409).json({ error: "This payment link has already been used." });
      return;
    }
    const { fullName, phoneNumber, deliveryAddress, paymentMethod } = body.data;
    const totalAmount = Number(
      (
        Number(row.order.productPrice) + Number(row.order.deliveryFee)
      ).toFixed(3),
    );
    const order = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(ordersTable)
        .set({
          buyerName: fullName,
          buyerPhone: phoneNumber,
          deliveryAddress,
          paymentMethod,
          buyerOtp: DEMO_OTP,
          status: "PAID & HELD",
        })
        .where(
          and(
            eq(ordersTable.id, row.order.id),
            eq(ordersTable.status, "CREATED"),
          ),
        )
        .returning();
      if (!updated) return null;
      await tx.insert(paymentsTable).values({
        orderId: row.order.id,
        amount: totalAmount,
        method: paymentMethod,
        status: "HELD",
        simulatedReference: `SIM-${randomBytes(5).toString("hex").toUpperCase()}`,
      });
      await tx.insert(notificationsTable).values({
        orderId: row.order.id,
        channel: "SIMULATED",
        message: "A simulated buyer payment was received and held for order protection.",
      });
      return updated;
    });
    if (!order) {
      res.status(409).json({ error: "This payment link has already been used." });
      return;
    }
    res.json(
      SimulatePaymentResponse.parse(orderResponse(order, row.merchant)),
    );
  },
);

router.post(
  "/garant/public/orders/:token/verify",
  async (req, res): Promise<void> => {
    const params = VerifyBuyerOtpParams.safeParse(req.params);
    const body = VerifyBuyerOtpBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!body.success) {
      res.status(400).json({
        error: body.error.message,
      });
      return;
    }
    const row = await getOrderByToken(params.data.token);
    if (!row) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    if (row.order.status !== "DELIVERED") {
      res.status(409).json({ error: "Phone confirmation is available after delivery." });
      return;
    }
    if (body.data.code !== DEMO_OTP) {
      res.status(400).json({ error: "That demo code is not correct." });
      return;
    }
    await db
      .update(ordersTable)
      .set({ otpVerified: true })
      .where(eq(ordersTable.id, row.order.id));
    res.json(
      VerifyBuyerOtpResponse.parse({
        success: true,
        message: "Phone number verified for this demo.",
      }),
    );
  },
);

router.post(
  "/garant/public/orders/:token/confirm",
  async (req, res): Promise<void> => {
    const params = ConfirmOrderReceivedParams.safeParse(req.params);
    const body = ConfirmOrderReceivedBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!body.success) {
      res.status(400).json({
        error: body.error.message,
      });
      return;
    }
    const row = await getOrderByToken(params.data.token);
    if (!row) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    if (row.order.status !== "DELIVERED") {
      res.status(409).json({ error: "Only delivered orders can be confirmed." });
      return;
    }
    if (body.data.code !== DEMO_OTP) {
      res.status(400).json({ error: "That demo code is not correct." });
      return;
    }
    const order = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(ordersTable)
        .set({ status: "COMPLETED", otpVerified: true })
        .where(
          and(
            eq(ordersTable.id, row.order.id),
            eq(ordersTable.status, "DELIVERED"),
          ),
        )
        .returning();
      if (!updated) return null;
      await tx
        .update(paymentsTable)
        .set({ status: "RELEASED", releasedAt: new Date() })
        .where(eq(paymentsTable.orderId, row.order.id));
      await tx.insert(notificationsTable).values({
        orderId: row.order.id,
        channel: "SIMULATED",
        message: "The buyer confirmed receipt. Simulated payment released to the merchant.",
      });
      return updated;
    });
    if (!order) {
      res.status(409).json({ error: "This order has already been completed." });
      return;
    }
    res.json(
      ConfirmOrderReceivedResponse.parse(
        orderResponse(order, row.merchant),
      ),
    );
  },
);

router.post(
  "/garant/public/orders/:token/disputes",
  async (req, res): Promise<void> => {
    const params = SubmitDisputeParams.safeParse(req.params);
    const body = SubmitDisputeBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!body.success) {
      res.status(400).json({
        error: body.error.message,
      });
      return;
    }
    const row = await getOrderByToken(params.data.token);
    if (!row) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    if (row.order.status !== "DELIVERED" || !row.order.otpVerified) {
      res.status(409).json({
        error: "Verify the buyer phone after delivery before submitting a complaint.",
      });
      return;
    }
    const dispute = await db.transaction(async (tx) => {
      const [updatedOrder] = await tx
      .update(ordersTable)
        .set({ status: "DISPUTED" })
        .where(
          and(
            eq(ordersTable.id, row.order.id),
            eq(ordersTable.status, "DELIVERED"),
            eq(ordersTable.otpVerified, true),
          ),
        )
        .returning();
      if (!updatedOrder) return null;
      const [createdDispute] = await tx
        .insert(disputesTable)
        .values({
          orderId: row.order.id,
          reason: body.data.reason,
          description: body.data.description,
          evidenceUrls: body.data.evidenceUrls ?? [],
          status: "OPEN",
        })
        .returning();
      await tx
        .update(paymentsTable)
        .set({ status: "DISPUTED" })
        .where(eq(paymentsTable.orderId, row.order.id));
      await tx.insert(notificationsTable).values({
        orderId: row.order.id,
        channel: "SIMULATED",
        message: "A buyer complaint was filed. The simulated payment is frozen for review.",
      });
      return { dispute: createdDispute, order: updatedOrder };
    });
    if (!dispute) {
      res.status(409).json({ error: "This order has already been updated." });
      return;
    }
    res.status(201).json(
      SubmitDisputeResponse.parse(
        disputeResponse(dispute.dispute, dispute.order, row.merchant),
      ),
    );
  },
);

export default router;
