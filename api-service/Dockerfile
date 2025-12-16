FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production --silent && npm cache clean --force
COPY src ./src
CMD ["node", "src/index.js"]
