FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

RUN npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 5020
ENV PORT=5020

CMD ["npm", "start"]
