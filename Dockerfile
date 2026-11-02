# Build: docker build -t btl-checklist .   (see DEPLOY.md, Option B)
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/build build
# The database lives in /app/data: mount it from the host so it survives rebuilds.
EXPOSE 3000
CMD ["node", "build"]
