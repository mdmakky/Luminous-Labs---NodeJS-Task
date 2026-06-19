import prisma from '../config/prisma.js';

/**
 * Deletes all expired refresh tokens from the database.
 * This is non-blocking and should be run on server startup.
 */
export const cleanupExpiredTokens = async () => {
  try {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    console.log(`[Token Cleanup] Expired refresh tokens cleaned up. Deleted count: ${result.count}`);
  } catch (error) {
    console.error('[Token Cleanup] Error cleaning up expired tokens:', error);
  }
};
