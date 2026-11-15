import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const merchantsTable = pgTable(
  "garant_merchants",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    fullName: text("full_name").notNull(),
    storeName: text("store_name").notNull(),
    email: text("email").notNull(),
    phoneNumber: text("phone_number").notNull(),
    role: text("role").notNull().default("merchant"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    clerkUserUnique: uniqueIndex("garant_merchants_clerk_user_unique").on(
      table.clerkUserId,
    ),
  }),
);

export const ordersTable = pgTable(
  "garant_orders",
  {
    id: serial("id").primaryKey(),
    token: text("token").notNull(),
    merchantId: integer("merchant_id")
      .notNull()
      .references(() => merchantsTable.id),
    productName: text("product_name").notNull(),
    description: text("description").notNull().default(""),
    imageUrl: text("image_url"),
    productPrice: real("product_price").notNull(),
    deliveryFee: real("delivery_fee").notNull().default(0),
    expectedDeliveryDate: text("expected_delivery_date").notNull(),
    notes: text("notes"),
    buyerName: text("buyer_name"),
    buyerPhone: text("buyer_phone"),
    deliveryAddress: text("delivery_address"),
    paymentMethod: text("payment_method"),
    status: text("status").notNull().default("CREATED"),
    carrier: text("carrier"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    buyerOtp: text("buyer_otp"),
    otpVerified: boolean("otp_verified").notNull().default(false),
  },
  (table) => ({
    tokenUnique: uniqueIndex("garant_orders_token_unique").on(table.token),
  }),
);

export const paymentsTable = pgTable("garant_payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => ordersTable.id),
  amount: real("amount").notNull(),
  method: text("method").notNull(),
  status: text("status").notNull().default("HELD"),
  simulatedReference: text("simulated_reference").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  refundedAmount: real("refunded_amount").notNull().default(0),
});

export const disputesTable = pgTable("garant_disputes", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => ordersTable.id),
  reason: text("reason").notNull(),
  description: text("description").notNull(),
  evidenceUrls: jsonb("evidence_urls").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("OPEN"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  merchantResponse: text("merchant_response"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  decision: text("decision"),
  refundAmount: real("refund_amount"),
  adminNote: text("admin_note"),
});

export const notificationsTable = pgTable("garant_notifications", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => ordersTable.id),
  channel: text("channel").notNull().default("SIMULATED"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type MerchantRecord = typeof merchantsTable.$inferSelect;
export type OrderRecord = typeof ordersTable.$inferSelect;
export type PaymentRecord = typeof paymentsTable.$inferSelect;
export type DisputeRecord = typeof disputesTable.$inferSelect;
