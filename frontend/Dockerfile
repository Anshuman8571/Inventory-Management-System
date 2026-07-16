FROM nginx:alpine

# Serve both public/ (html, manifest, icons) and src/ (js, css) from the same root,
# matching the relative paths used in index.html (../src/...).
COPY public /usr/share/nginx/html
COPY src /usr/share/nginx/html/src
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
