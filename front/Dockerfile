FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --silent && npm cache clean --force
COPY . .
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
