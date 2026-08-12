import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (prismaInstance) return prismaInstance;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined');
  }

  const adapter = new PrismaPg({
    connectionString,
  });

  prismaInstance = new PrismaClient({ adapter });
  // Ensure Prisma disconnects when the Node process is exiting to avoid
  // lingering handles across Jest worker processes.
  process.once('beforeExit', () => {
    // fire-and-forget; don't block shutdown
    prismaInstance?.$disconnect().catch(() => {});
  });
  return prismaInstance;
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    try {
      await prismaInstance.$disconnect();
    } finally {
      prismaInstance = null;
    }
  }
}
