import { pgTable, text, integer, timestamp, pgEnum, uuid } from 'drizzle-orm/pg-core';

// Enums
export const TransactionType = pgEnum('type', ['sent', 'received', 'paid', 'withdraw', 'deposit', 'airtime', 'transfer', 'fee', 'unknown']);
export const Direction = pgEnum('direction', ['in', 'out']);
export const Source = pgEnum('source', ['mpesa', 'coop']);

// Users table
export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Financial accounts
export const accounts = pgTable('accounts', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  type: text().notNull(),
  balanceCents: integer('balance_cents').notNull().default(0),
  currency: text().notNull().default('KES'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Transactions table - adapted from original SQLite schema for PostgreSQL
export const transactions = pgTable('transactions', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  dedupeKey: text('dedupe_key').notNull().unique(),
  source: source('source').notNull().default('mpesa'),
  type: type('type').notNull().default('unknown'),
  direction: direction('direction').notNull().default('out'),
  amount: integer('amount').notNull(), // cents
  fee: integer('fee').notNull().default(0), // cents
  counterparty: text('counterparty'),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  relatedRef: text('related_ref'),
  transferGroup: text('transfer_group'),
  occurredAt: timestamp('occurred_at').notNull(),
  rawText: text('raw_text').notNull(),
  deviceId: text('device_id').notNull(),
  synced: integer('synced').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Categories table
export const categories = pgTable('categories', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  color: text(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  unique(userId, name),
});

// Category rules for automatic categorisation
export const categoryRules = pgTable('category_rules', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  matchField: text('match_field').notNull().default('counterparty'),
  matchValue: text('match_value').notNull(),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  unique(userId, matchField, matchValue),
});

// Budgets
export const budgets = pgTable('budgets', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  amountCents: integer('amount_cents').notNull(),
  period: text('period').notNull().default('month'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Refresh tokens
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});