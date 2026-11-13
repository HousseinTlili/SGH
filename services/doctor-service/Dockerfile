FROM node:22-alpine
WORKDIR /app
COPY package*.json tsconfig*.json ./
RUN npm install
COPY . .
EXPOSE 8083
CMD ["npm", "start"]
