import { clerkClient, getAuth } from "@clerk/express";
import type { Request, Response } from "express";
import { and, eq, lte } from "drizzle-orm";
import {
  db,
  disputesTable,
  merchantsTable,
  notificationsTable,
  ordersTable,
  paymentsTable,
  type DisputeRecord,
  type MerchantRecord,
  type OrderRecord,
} from "@workspace/db";

export function authenticatedUserId(req: Request, res: Response): string | null {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return null;
  }
  return userId;
}

export async function merchantForUser(
  userId: string,
): Promise<MerchantRecord | undefined> {
  const [merchant] = await db
    .select()
    .from(merchantsTable)
    .where(eq(merchantsTable.clerkUserId, userId))
    .limit(1);
  return merchant;
}

export async function requireMerchant(
  req: Request,
  res: Response,
): Promise<MerchantRecord | null> {
  const userId = authenticatedUserId(req, res);
  if (!userId) return null;
  const merchant = await merchantForUser(userId);
  if (!merchant) {
    res.status(409).json({ error: "Complete your merchant profile first." });
    return null;
  }
  return merchant;
}

export async function requireAdmin(
  req: Request,
  res: Response,
): Promise<MerchantRecord | null> {
  const merchant = await requireMerchant(req, res);
  if (!merchant) return null;
  if (merchant.role !== "admin") {
    res.status(403).json({ error: "Administrator access is required." });
    return null;
  }
  return merchant;
}

export async function clerkEmailForUser(userId: string): Promise<string> {
  const user = await clerkClient.users.getUser(userId);
  const primary = user.emailAddresses.find(
    (address) => address.id === user.primaryEmailAddressId,
  );
  if (!primary?.emailAddress) {
    throw new Error("A verified primary email address is required.");
  }
  return primary.emailAddress;
}

export function orderResponse(
  order: OrderRecord,
  merchant: MerchantRecord,
) {
  return {
    id: order.id,
    token: order.token,
    merchantId: merchant.id,
    merchantName: merchant.fullName,
    storeName: merchant.storeName,
    merchantPhone: merchant.phoneNumber,
    productName: order.productName,
    description: order.description,
    imageUrl: order.imageUrl,
    productPrice: Number(order.productPrice),
    deliveryFee: Number(order.deliveryFee),
    totalAmount: Number(
      (Number(order.productPrice) + Number(order.deliveryFee)).toFixed(3),
    ),
    expectedDeliveryDate: order.expectedDeliveryDate,
    notes: order.notes,
    buyerName: order.buyerName,
    buyerPhone: order.buyerPhone,
    deliveryAddress: order.deliveryAddress,
    paymentMethod: order.paymentMethod,
    status: order.status,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    createdAt: order.createdAt,
    deliveredAt: order.deliveredAt,
  };
}

export function disputeResponse(
  dispute: DisputeRecord,
  order: OrderRecord,
  merchant: MerchantRecord,
) {
  return {
    id: dispute.id,
    orderId: order.id,
    orderToken: order.token,
    merchantName: merchant.storeName,
    productName: order.productName,
    buyerName: order.buyerName,
    reason: dispute.reason,
    description: dispute.description,
    evidenceUrls: dispute.evidenceUrls,
    status: dispute.status,
    createdAt: dispute.createdAt,
    adminNote: dispute.adminNote,
    merchantResponse: dispute.merchantResponse,
  };
}

export async function addSimulatedNotification(
  orderId: number,
  message: string,
): Promise<void> {
  await db.insert(notificationsTable).values({
    orderId,
    channel: "SIMULATED",
    message,
  });
}

export async function releaseExpiredOrders(): Promise<void> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const expired = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.status, "DELIVERED"),
        lte(ordersTable.deliveredAt, cutoff),
      ),
    );
  for (const order of expired) {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(ordersTable)
        .set({ status: "COMPLETED" })
        .where(
          and(eq(ordersTable.id, order.id), eq(ordersTable.status, "DELIVERED")),
        )
        .returning({ id: ordersTable.id });
      if (!updated) return;
      await tx
        .update(paymentsTable)
        .set({ status: "RELEASED", releasedAt: new Date() })
        .where(
          and(
            eq(paymentsTable.orderId, order.id),
            eq(paymentsTable.status, "HELD"),
          ),
        );
      await tx.insert(notificationsTable).values({
        orderId: order.id,
        channel: "SIMULATED",
        message: "Payment released after the 48-hour buyer confirmation window.",
      });
    });
  }
}
