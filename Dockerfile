FROM node:18

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

RUN npm ci --omit=dev

EXPOSE 5020

CMD ["npm", "start"]
