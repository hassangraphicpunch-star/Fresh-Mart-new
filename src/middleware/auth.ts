import { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: {
    id: number;
    uid: string;
    email: string;
    displayName: string | null;
    role: string;
  };
}

function getBootstrapAdminEmails(): string[] {
  const configured = process.env.ADMIN_EMAILS || 'hassangraphicpunch@gmail.com';
  return configured
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string
) {
  try {
    const normalizedEmail = email.toLowerCase();
    const adminEmails = getBootstrapAdminEmails();

    const existingAdmins = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1);

    const isBootstrapAdmin =
      adminEmails.includes(normalizedEmail) || existingAdmins.length === 0;

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);

    if (existing.length > 0) {
      const current = existing[0];
      const nextRole =
        current.role === 'admin' || adminEmails.includes(normalizedEmail)
          ? 'admin'
          : current.role;

      const updated = await db
        .update(users)
        .set({
          email: normalizedEmail,
          displayName: displayName ?? current.displayName,
          role: nextRole,
          updatedAt: new Date(),
        })
        .where(eq(users.uid, uid))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        displayName: displayName ?? null,
        role: isBootstrapAdmin ? 'admin' : 'customer',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
          displayName: displayName ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database user upsert failed:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const dbUser = await getOrCreateUser(
      decodedToken.uid,
      decodedToken.email || '',
      decodedToken.name
    );
    req.dbUser = dbUser;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  await requireAuth(req, res, () => {
    if (!req.dbUser || req.dbUser.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden: Store administrator access required.',
      });
    }
    next();
  });
};
