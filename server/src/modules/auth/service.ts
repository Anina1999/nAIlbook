import bcrypt from 'bcrypt';
import { Prisma, type Role } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { signToken } from '../../lib/jwt.js';
import { prisma } from '../../lib/prisma.js';
import type { LoginInput, RegisterInput } from './schemas.js';

const BCRYPT_COST = 10;

// Compared against when the email is unknown, so login takes the same time
// whether or not the account exists.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_COST);

// The only user fields the API returns. Never passwordHash or tokenVersion.
const publicUser = { id: true, email: true, name: true, phone: true, role: true } as const;

export async function register(input: RegisterInput) {
  const exists = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (exists) throw emailTaken();

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const profile =
    input.role === 'MANICURIST'
      ? { create: { city: input.city, address: input.address, bio: input.bio } }
      : undefined;

  try {
    // A nested create runs in one transaction: the user and the profile are saved together.
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
        phone: input.phone,
        role: input.role,
        profile,
      },
      select: { ...publicUser, tokenVersion: true },
    });
    return session(user);
  } catch (err) {
    // Two registrations with the same email at the same moment.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw emailTaken();
    throw err;
  }
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...publicUser, passwordHash: true, tokenVersion: true },
  });
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new AppError('INVALID_CREDENTIALS', 'Грешен имейл или парола.');

  const { passwordHash: _, ...rest } = user;
  return session(rest);
}

export async function getMe(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUser });
  if (!user) throw new AppError('UNAUTHORIZED', 'Моля, влезте в профила си.');
  return user;
}

// Every token signed before this call stops working (see requireAuth).
export async function logout(userId: number) {
  await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
}

function session<T extends { id: number; role: Role; tokenVersion: number }>(user: T) {
  const { tokenVersion: _, ...rest } = user;
  return { token: signToken(user), user: rest };
}

function emailTaken() {
  return new AppError('EMAIL_TAKEN', 'Този имейл вече е регистриран.');
}
