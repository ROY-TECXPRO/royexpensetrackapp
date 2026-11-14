import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const transactionImportSchema = z.object({
  parsedTransactions: z.array(z.object({
    dedupeKey: z.string(),
    source: z.enum(['mpesa', 'coop']),
    type: z.enum(['sent', 'received', 'paid', 'withdraw', 'deposit', 'airtime', 'transfer', 'fee', 'unknown']),
    direction: z.enum(['in', 'out']),
    amount: z.number(),
    fee: z.number().default(0),
    counterparty: z.string().nullable(),
    categoryId: z.string().nullable(),
    relatedRef: z.string().nullable(),
    transferGroup: z.string().nullable(),
    occurredAt: z.string(),
    rawText: z.string(),
    deviceId: z.string().optional(),
  })),
});

export const updateTransactionSchema = z.object({
  categoryId: z.string().nullable(),
  type: z.enum(['sent', 'received', 'paid', 'withdraw', 'deposit', 'airtime', 'transfer', 'fee', 'unknown']).optional(),
  direction: z.enum(['in', 'out']).optional(),
  amount: z.number().optional(),
  fee: z.number().optional(),
  counterparty: z.string().nullable().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(2).max(50),
  color: z.string().optional(),
});

export const budgetSchema = z.object({
  categoryId: z.string(),
  amountCents: z.number().int().positive(),
  period: z.enum(['day', 'week', 'month', 'year']).optional(),
});