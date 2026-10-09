# locoacresfarm.com: website + holiday order API. No dependencies, just Node 20.
FROM node:20-alpine
WORKDIR /app
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/index.js"]
