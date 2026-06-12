# Friday Frontend – Build + statisches Serving via Nginx
# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .
RUN npm run build

# Stage 2: Serve (schlankes Nginx)
# Die Server-Config wird per Compose-Volume aus docker/nginx/default.conf
# gemountet (Single Source), daher hier kein COPY der conf.
FROM nginx:1.27-alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
