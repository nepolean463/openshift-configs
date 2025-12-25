FROM alpine:latest

RUN apk update && apk add --no-cache \
    nginx curl wget net-tools iputils bind-tools vim

# FIX 1: Create the directory and permissions
RUN mkdir -p /var/lib/nginx/html && \
    echo "<h1>Net-Tool Container Running</h1>" > /var/lib/nginx/html/index.html && \
    chown -R nginx:nginx /var/lib/nginx && \
    chmod -R 777 /var/lib/nginx /var/log/nginx /run/nginx

# FIX 2: Configure Nginx to listen on 8080 (Non-root friendly)
# We overwrite the default config on the fly to listen on 8080 and store PIDs in /tmp
RUN sed -i 's/listen 80;/listen 8080;/' /etc/nginx/http.d/default.conf && \
    sed -i 's/user nginx;//' /etc/nginx/nginx.conf

# Configure Nginx to run
CMD ["nginx", "-g", "daemon off; pid /tmp/nginx.pid;"]

EXPOSE 8080
