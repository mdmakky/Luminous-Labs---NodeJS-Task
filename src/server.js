import app from './app.js';
import env from './config/env.js';
import prisma from './config/prisma.js';
import { cleanupExpiredTokens } from './utils/token-cleanup.js';

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${env.NODE_ENV}`);
  
  // Non-blocking cleanup of expired refresh tokens on startup
  cleanupExpiredTokens();
});

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Database disconnected. Server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
