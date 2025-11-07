FROM nginx:1.27-alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Create directory for static files (mounted as volume from frontend build)
RUN mkdir -p /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/health || exit 1

EXPOSE 80
