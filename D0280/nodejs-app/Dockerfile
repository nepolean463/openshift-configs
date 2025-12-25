FROM quay.io/redhattraining/nodejs:8.0
COPY . /opt/app-root/src
WORKDIR /opt/app-root/src
RUN if [ -f package.json ]; then npm install; fi
EXPOSE 8080
CMD ["npm", "start"]
