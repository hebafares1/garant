import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  CreatePaymentLinkBody,
  CreatePaymentLinkResponse,
  GetMerchantOverviewResponse,
  GetMerchantProfileResponse,
  ListMerchantDisputesResponse,
  ListMerchantOrdersResponse,
  MarkOrderDeliveredParams,
  MarkOrderDeliveredResponse,
  RespondToDisputeBody,
  RespondToDisputeParams,
  RespondToDisputeResponse,
  SaveMerchantProfileBody,
  SaveMerchantProfileResponse,
  UpdateShippingBody,
  UpdateShippingParams,
  UpdateShippingResponse,
} from "@workspace/api-zod";
import {
  db,
  disputesTable,
  merchantsTable,
  ordersTable,
  paymentsTable,
} from "@workspace/db";
import {
  addSimulatedNotification,
  authenticatedUserId,
  clerkEmailForUser,
  disputeResponse,
  merchantForUser,
  orderResponse,
  requireMerchant,
} from "../lib/garant";
import { randomBytes } from "node:crypto";

const router: IRouter = Router();

async function seedDevelopmentOrders(merchantId: number): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  const alreadyHasOrders = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(eq(ordersTable.merchantId, merchantId))
    .limit(1);
  if (alreadyHasOrders.length) return;

  const expectedDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };
  const samples = [
    {
      token: randomBytes(4).toString("hex"),
      productName: "Hand-thrown ceramic pour-over set",
      description: "A two-piece stoneware set made in small batches.",
      productPrice: 24.5,
      deliveryFee: 2,
      status: "PAID & HELD",
      buyerName: "Mariam A.",
      buyerPhone: "+965 5555 0101",
      deliveryAddress: "Salmiya, Block 10, Kuwait",
      paymentMethod: "KNET",
      carrier: null,
      trackingNumber: null,
      trackingUrl: null,
      reason: null,
    },
    {
      token: randomBytes(4).toString("hex"),
      productName: "Linen weekend tote",
      description: "Locally sewn natural linen carry-all.",
      productPrice: 18,
      deliveryFee: 1.5,
      status: "SHIPPED",
      buyerName: "Noor S.",
      buyerPhone: "+965 5555 0122",
      deliveryAddress: "Hawally, Block 5, Kuwait",
      paymentMethod: "CARD",
      carrier: "Aramex",
      trackingNumber: "KW-GT-2048",
      trackingUrl: "https://www.aramex.com/track",
      reason: null,
    },
    {
      token: randomBytes(4).toString("hex"),
      productName: "Amber perfume discovery set",
      description: "Three small-batch fragrances inspired by the Gulf.",
      productPrice: 32,
      deliveryFee: 2,
      status: "DISPUTED",
      buyerName: "Dana R.",
      buyerPhone: "+965 5555 0144",
      deliveryAddress: "Kuwait City, Sharq, Kuwait",
      paymentMethod: "KNET",
      carrier: "Local courier",
      trackingNumber: "KW-11420",
      trackingUrl: "https://example.com/track",
      reason: "NOT_AS_DESCRIBED",
    },
  ] as const;

  for (const sample of samples) {
    const [order] = await db
      .insert(ordersTable)
      .values({
        token: sample.token,
        merchantId,
        productName: sample.productName,
        description: sample.description,
        productPrice: sample.productPrice,
        deliveryFee: sample.deliveryFee,
        expectedDeliveryDate: expectedDate(4),
        status: sample.status,
        buyerName: sample.buyerName,
        buyerPhone: sample.buyerPhone,
        deliveryAddress: sample.deliveryAddress,
        paymentMethod: sample.paymentMethod,
        carrier: sample.carrier,
        trackingNumber: sample.trackingNumber,
        trackingUrl: sample.trackingUrl,
        deliveredAt: sample.status === "DISPUTED" ? new Date() : null,
        buyerOtp: sample.status === "DISPUTED" ? "123456" : null,
        otpVerified: sample.status === "DISPUTED",
      })
      .returning();
    await db.insert(paymentsTable).values({
      orderId: order.id,
      amount: Number((sample.productPrice + sample.deliveryFee).toFixed(3)),
      method: sample.paymentMethod,
      status: sample.status === "DISPUTED" ? "DISPUTED" : "HELD",
      simulatedReference: `DEMO-${randomBytes(4).toString("hex").toUpperCase()}`,
    });
    if (sample.reason) {
      await db.insert(disputesTable).values({
        orderId: order.id,
        reason: sample.reason,
        description:
          "The scent profile is different from the description in the product listing. Please review the order and product details.",
        evidenceUrls: [],
        status: "OPEN",
      });
    }
  }
}

router.get("/garant/merchant/profile", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const merchant = await merchantForUser(userId);
  if (!merchant) {
    res.status(404).json({ error: "Merchant profile not found." });
    return;
  }
  res.json(
    GetMerchantProfileResponse.parse({
      id: merchant.id,
      clerkUserId: merchant.clerkUserId,
      fullName: merchant.fullName,
      storeName: merchant.storeName,
      email: merchant.email,
      phoneNumber: merchant.phoneNumber,
      role: merchant.role,
      createdAt: merchant.createdAt,
    }),
  );
});

router.post("/garant/merchant/profile", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const parsed = SaveMerchantProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const email = await clerkEmailForUser(userId);
  const existing = await merchantForUser(userId);
  const configuredAdminEmail = process.env.GARANT_ADMIN_EMAIL?.trim().toLowerCase();
  const role =
    existing?.role === "admin" ||
    email.toLowerCase() === configuredAdminEmail
      ? "admin"
      : "merchant";
  const [merchant] = await db
    .insert(merchantsTable)
    .values({
      clerkUserId: userId,
      email,
      role,
      ...parsed.data,
    })
    .onConflictDoUpdate({
      target: merchantsTable.clerkUserId,
      set: {
        fullName: parsed.data.fullName,
        storeName: parsed.data.storeName,
        phoneNumber: parsed.data.phoneNumber,
        email,
        role,
      },
    })
    .returning();
  if (!existing) await seedDevelopmentOrders(merchant.id);
  res.json(
    SaveMerchantProfileResponse.parse({
      id: merchant.id,
      clerkUserId: merchant.clerkUserId,
      fullName: merchant.fullName,
      storeName: merchant.storeName,
      email: merchant.email,
      phoneNumber: merchant.phoneNumber,
      role: merchant.role,
      createdAt: merchant.createdAt,
    }),
  );
});

router.get("/garant/merchant/overview", async (req, res): Promise<void> => {
  const merchant = await requireMerchant(req, res);
  if (!merchant) return;
  const [orders, paymentRows] = await Promise.all([
    db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.merchantId, merchant.id))
      .orderBy(desc(ordersTable.createdAt)),
    db
      .select({ payment: paymentsTable, order: ordersTable })
      .from(paymentsTable)
      .innerJoin(ordersTable, eq(paymentsTable.orderId, ordersTable.id))
      .where(eq(ordersTable.merchantId, merchant.id)),
  ]);
  const completedPayments = paymentRows.filter(
    ({ payment }) => payment.status === "RELEASED",
  );
  const heldPayments = paymentRows.filter(
    ({ payment }) => payment.status === "HELD",
  );
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklySales = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - index));
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const amount = completedPayments
      .filter(
        ({ payment }) =>
          payment.createdAt.getTime() >= start.getTime() &&
          payment.createdAt.getTime() < end.getTime() &&
          payment.createdAt.getTime() >= cutoff,
      )
      .reduce((sum, { payment }) => sum + Number(payment.amount), 0);
    return {
      day: day.toLocaleDateString("en", { weekday: "short" }),
      amount: Number(amount.toFixed(3)),
    };
  });
  res.json(
    GetMerchantOverviewResponse.parse({
      totalSales: Number(
        completedPayments
          .reduce((sum, { payment }) => sum + Number(payment.amount), 0)
          .toFixed(3),
      ),
      totalOrders: orders.length,
      pendingPayments: Number(
        heldPayments
          .reduce((sum, { payment }) => sum + Number(payment.amount), 0)
          .toFixed(3),
      ),
      completedOrders: orders.filter((order) => order.status === "COMPLETED")
        .length,
      disputedOrders: orders.filter((order) => order.status === "DISPUTED")
        .length,
      weeklySales,
      recentOrders: orders.slice(0, 6).map((order) =>
        orderResponse(order, merchant),
      ),
    }),
  );
});

router.get("/garant/merchant/orders", async (req, res): Promise<void> => {
  const merchant = await requireMerchant(req, res);
  if (!merchant) return;
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.merchantId, merchant.id))
    .orderBy(desc(ordersTable.createdAt));
  res.json(
    ListMerchantOrdersResponse.parse(
      orders.map((order) => orderResponse(order, merchant)),
    ),
  );
});

router.post(
  "/garant/merchant/payment-links",
  async (req, res): Promise<void> => {
    const merchant = await requireMerchant(req, res);
    if (!merchant) return;
    const parsed = CreatePaymentLinkBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const data = parsed.data;
    if (data.imageUrl && data.imageUrl.length > 5_500_000) {
      res.status(413).json({ error: "Product image must be under 4 MB." });
      return;
    }
    const token = randomBytes(4).toString("hex");
    const expectedDeliveryDate =
      data.expectedDeliveryDate instanceof Date
        ? data.expectedDeliveryDate.toISOString().slice(0, 10)
        : String(data.expectedDeliveryDate).slice(0, 10);
    const [order] = await db
      .insert(ordersTable)
      .values({
        token,
        merchantId: merchant.id,
        productName: data.productName,
        description: data.description,
        imageUrl: data.imageUrl ?? null,
        productPrice: data.productPrice,
        deliveryFee: data.deliveryFee,
        expectedDeliveryDate,
        notes: data.notes ?? null,
      })
      .returning();
    res.status(201).json(
      CreatePaymentLinkResponse.parse(orderResponse(order, merchant)),
    );
  },
);

router.post(
  "/garant/merchant/orders/:orderId/shipping",
  async (req, res): Promise<void> => {
    const merchant = await requireMerchant(req, res);
    if (!merchant) return;
    const params = UpdateShippingParams.safeParse(req.params);
    const body = UpdateShippingBody.safeParse(req.body);
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
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.id, params.data.orderId),
          eq(ordersTable.merchantId, merchant.id),
        ),
      )
      .limit(1);
    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    if (order.status !== "PAID & HELD") {
      res.status(409).json({ error: "Only paid and held orders can be shipped." });
      return;
    }
    const [updated] = await db
      .update(ordersTable)
      .set({
        status: "SHIPPED",
        carrier: body.data.carrier,
        trackingNumber: body.data.trackingNumber,
        trackingUrl: body.data.trackingUrl,
      })
      .where(eq(ordersTable.id, order.id))
      .returning();
    await addSimulatedNotification(
      order.id,
      `A simulated WhatsApp/SMS update was queued with tracking ${body.data.trackingNumber}.`,
    );
    res.json(
      UpdateShippingResponse.parse(orderResponse(updated, merchant)),
    );
  },
);

router.post(
  "/garant/merchant/orders/:orderId/delivered",
  async (req, res): Promise<void> => {
    const merchant = await requireMerchant(req, res);
    if (!merchant) return;
    const params = MarkOrderDeliveredParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.id, params.data.orderId),
          eq(ordersTable.merchantId, merchant.id),
        ),
      )
      .limit(1);
    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    if (order.status !== "SHIPPED") {
      res.status(409).json({ error: "Only shipped orders can be marked delivered." });
      return;
    }
    const deliveredAt = new Date();
    const [updated] = await db
      .update(ordersTable)
      .set({ status: "DELIVERED", deliveredAt })
      .where(eq(ordersTable.id, order.id))
      .returning();
    await addSimulatedNotification(
      order.id,
      "A simulated delivery confirmation message was queued for the buyer.",
    );
    res.json(
      MarkOrderDeliveredResponse.parse(orderResponse(updated, merchant)),
    );
  },
);

router.get("/garant/merchant/disputes", async (req, res): Promise<void> => {
  const merchant = await requireMerchant(req, res);
  if (!merchant) return;
  const rows = await db
    .select({ dispute: disputesTable, order: ordersTable })
    .from(disputesTable)
    .innerJoin(ordersTable, eq(disputesTable.orderId, ordersTable.id))
    .where(eq(ordersTable.merchantId, merchant.id))
    .orderBy(desc(disputesTable.createdAt));
  res.json(
    ListMerchantDisputesResponse.parse(
      rows.map(({ dispute, order }) =>
        disputeResponse(dispute, order, merchant),
      ),
    ),
  );
});

router.post(
  "/garant/merchant/disputes/:disputeId/response",
  async (req, res): Promise<void> => {
    const merchant = await requireMerchant(req, res);
    if (!merchant) return;
    const params = RespondToDisputeParams.safeParse(req.params);
    const body = RespondToDisputeBody.safeParse(req.body);
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
      .select({ dispute: disputesTable, order: ordersTable })
      .from(disputesTable)
      .innerJoin(ordersTable, eq(disputesTable.orderId, ordersTable.id))
      .where(
        and(
          eq(disputesTable.id, params.data.disputeId),
          eq(ordersTable.merchantId, merchant.id),
        ),
      )
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Dispute not found." });
      return;
    }
    if (
      row.dispute.status !== "OPEN" ||
      Date.now() - row.dispute.createdAt.getTime() > 24 * 60 * 60 * 1000
    ) {
      res.status(409).json({
        error: "The 24-hour merchant response window has passed or this dispute is closed.",
      });
      return;
    }
    const [updated] = await db
      .update(disputesTable)
      .set({
        merchantResponse: body.data.response,
        respondedAt: new Date(),
        status: "MERCHANT_RESPONDED",
      })
      .where(eq(disputesTable.id, row.dispute.id))
      .returning();
    await addSimulatedNotification(
      row.order.id,
      "The merchant submitted a response to your complaint.",
    );
    res.json(
      RespondToDisputeResponse.parse(
        disputeResponse(updated, row.order, merchant),
      ),
    );
  },
);

export default router;
