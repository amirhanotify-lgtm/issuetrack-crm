FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY src ./src
RUN npm install --omit=dev
EXPOSE 5000
CMD ["node", "src/index.js"]
