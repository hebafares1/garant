import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  DecideDisputeBody,
  DecideDisputeParams,
  DecideDisputeResponse,
  GetAdminOverviewResponse,
  ListAdminDisputesResponse,
  ListAdminOrdersResponse,
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
  disputeResponse,
  orderResponse,
  requireAdmin,
} from "../lib/garant";

const router: IRouter = Router();

router.get("/garant/admin/overview", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const [merchants, orders, payments, disputes] = await Promise.all([
    db.select().from(merchantsTable),
    db.select().from(ordersTable),
    db.select().from(paymentsTable),
    db.select().from(disputesTable),
  ]);
  res.json(
    GetAdminOverviewResponse.parse({
      totalMerchants: merchants.filter((merchant) => merchant.role === "merchant")
        .length,
      totalOrders: orders.length,
      transactionVolume: Number(
        payments.reduce((sum, payment) => sum + Number(payment.amount), 0).toFixed(3),
      ),
      heldPayments: Number(
        payments
          .filter((payment) => ["HELD", "DISPUTED"].includes(payment.status))
          .reduce((sum, payment) => sum + Number(payment.amount), 0)
          .toFixed(3),
      ),
      completedOrders: orders.filter((order) => order.status === "COMPLETED")
        .length,
      openDisputes: disputes.filter((dispute) =>
        ["OPEN", "MERCHANT_RESPONDED"].includes(dispute.status),
      ).length,
    }),
  );
});

router.get("/garant/admin/orders", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const rows = await db
    .select({ order: ordersTable, merchant: merchantsTable })
    .from(ordersTable)
    .innerJoin(merchantsTable, eq(ordersTable.merchantId, merchantsTable.id))
    .orderBy(desc(ordersTable.createdAt));
  res.json(
    ListAdminOrdersResponse.parse(
      rows.map(({ order, merchant }) => orderResponse(order, merchant)),
    ),
  );
});

router.get("/garant/admin/disputes", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const rows = await db
    .select({
      dispute: disputesTable,
      order: ordersTable,
      merchant: merchantsTable,
    })
    .from(disputesTable)
    .innerJoin(ordersTable, eq(disputesTable.orderId, ordersTable.id))
    .innerJoin(merchantsTable, eq(ordersTable.merchantId, merchantsTable.id))
    .orderBy(desc(disputesTable.createdAt));
  res.json(
    ListAdminDisputesResponse.parse(
      rows.map(({ dispute, order, merchant }) =>
        disputeResponse(dispute, order, merchant),
      ),
    ),
  );
});

router.post(
  "/garant/admin/disputes/:disputeId/decision",
  async (req, res): Promise<void> => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const params = DecideDisputeParams.safeParse(req.params);
    const body = DecideDisputeBody.safeParse(req.body);
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
    const [row] = await db
      .select({ dispute: disputesTable, order: ordersTable, merchant: merchantsTable })
      .from(disputesTable)
      .innerJoin(ordersTable, eq(disputesTable.orderId, ordersTable.id))
      .innerJoin(merchantsTable, eq(ordersTable.merchantId, merchantsTable.id))
      .where(eq(disputesTable.id, params.data.disputeId))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Dispute not found." });
      return;
    }
    if (!["OPEN", "MERCHANT_RESPONDED"].includes(row.dispute.status)) {
      res.status(409).json({ error: "This dispute is already resolved." });
      return;
    }
    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.orderId, row.order.id))
      .limit(1);
    if (!payment) {
      res.status(409).json({ error: "No simulated payment is attached to this order." });
      return;
    }
    const fullAmount = Number(payment.amount);
    const decision = body.data.decision;
    const refundAmount =
      decision === "FULL_REFUND"
        ? fullAmount
        : decision === "PARTIAL_REFUND"
          ? Number(body.data.refundAmount ?? 0)
          : 0;
    if (
      decision === "PARTIAL_REFUND" &&
      (refundAmount <= 0 || refundAmount >= fullAmount)
    ) {
      res.status(400).json({
        error: "A partial refund must be greater than zero and less than the order total.",
      });
      return;
    }

    const resolved = await db.transaction(async (tx) => {
      const paymentStatus =
        decision === "FULL_REFUND"
          ? "REFUNDED"
          : decision === "PARTIAL_REFUND"
            ? "PARTIALLY_REFUNDED"
            : "RELEASED";
      await tx
        .update(paymentsTable)
        .set({
          status: paymentStatus,
          refundedAmount: refundAmount,
          releasedAt: decision === "FULL_REFUND" ? null : new Date(),
        })
        .where(
          and(
            eq(paymentsTable.orderId, row.order.id),
            eq(paymentsTable.status, "DISPUTED"),
          ),
        );
      await tx
        .update(ordersTable)
        .set({ status: "COMPLETED" })
        .where(eq(ordersTable.id, row.order.id));
      const [updatedDispute] = await tx
        .update(disputesTable)
        .set({
          status: "RESOLVED",
          decision,
          refundAmount,
          adminNote: body.data.adminNote ?? null,
        })
        .where(eq(disputesTable.id, row.dispute.id))
        .returning();
      await tx.insert(notificationsTable).values({
        orderId: row.order.id,
        channel: "SIMULATED",
        message: `Administrator resolved the dispute with decision ${decision}.`,
      });
      return updatedDispute;
    });
    res.json(
      DecideDisputeResponse.parse(
        disputeResponse(resolved, row.order, row.merchant),
      ),
    );
  },
);

export default router;
