FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci --prefix frontend
COPY frontend ./frontend
COPY shared ./shared
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5010
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend ./backend
COPY shared ./shared
COPY uploads ./uploads
COPY --from=build /app/frontend/dist ./frontend/dist
RUN chown -R node:node /app
USER node
EXPOSE 5010
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5010)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/index.js"]
