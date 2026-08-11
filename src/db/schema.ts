import {
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  marketDataProvider: varchar("market_data_provider", { length: 32 })
    .notNull()
    .default("nse"),
  strategicWeight: integer("strategic_weight").notNull().default(60),
  navOpportunityWeight: integer("nav_opportunity_weight").notNull().default(40),
  tacticalTopupAmount: numeric("tactical_topup_amount", {
    precision: 14,
    scale: 2,
  }),
  fundsConfig: jsonb("funds_config").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const navHistory = pgTable(
  "nav_history",
  {
    id: serial("id").primaryKey(),
    schemeCode: varchar("scheme_code", { length: 32 }).notNull(),
    schemeName: text("scheme_name").notNull(),
    nav: numeric("nav", { precision: 14, scale: 4 }).notNull(),
    navDate: date("nav_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    navSchemeDateUnique: uniqueIndex("nav_history_scheme_date_unique").on(
      table.schemeCode,
      table.navDate,
    ),
  }),
);

export const indexHistory = pgTable(
  "index_history",
  {
    id: serial("id").primaryKey(),
    indexName: varchar("index_name", { length: 128 }).notNull(),
    indexValue: numeric("index_value", { precision: 14, scale: 4 }).notNull(),
    changePercent: numeric("change_percent", { precision: 8, scale: 3 }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    indexRecordedUnique: uniqueIndex("index_history_name_recorded_unique").on(
      table.indexName,
      table.recordedAt,
    ),
  }),
);

export const dashboardSnapshots = pgTable("dashboard_snapshots", {
  id: serial("id").primaryKey(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
