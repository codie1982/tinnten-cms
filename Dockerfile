FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

RUN npm prune --omit=dev

EXPOSE 5020

CMD ["npm", "start"]
