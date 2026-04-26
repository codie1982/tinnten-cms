FROM node:18

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

RUN npm run build

EXPOSE 5020

CMD ["npm", "start"]
