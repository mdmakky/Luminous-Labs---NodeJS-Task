FROM node:20-alpine

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install npm dependencies
RUN npm ci

# Copy Prisma schema and generate Client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source and configuraiton files
COPY src ./src/
COPY eslint.config.js jest.config.js ./

EXPOSE 3000

# Start command
CMD ["npm", "start"]
