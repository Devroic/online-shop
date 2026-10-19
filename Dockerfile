# --- build the React app
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY . .
RUN npm run build

# --- runtime: API + built client, one process
FROM node:22-alpine
ENV NODE_ENV=production DATA_DIR=/data PORT=4000
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev -w server && npm cache clean --force
COPY server server
COPY --from=build /app/client/dist client/dist
VOLUME /data
EXPOSE 4000
CMD ["node", "server/src/index.js"]
