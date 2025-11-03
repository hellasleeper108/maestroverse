FROM node:18-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy application files
COPY . .

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 3001 3004

CMD ["npm", "run", "dev"]
