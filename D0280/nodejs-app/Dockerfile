FROM registry.access.redhat.com/ubi8/nodejs-16
USER 1001
# Copy package files
COPY --chown=1001:0 package*.json ./
# Install dependencies
RUN npm install --production
# Copy application code
COPY --chown=1001:0 . .
EXPOSE 8080
CMD ["node", "app.js"]
