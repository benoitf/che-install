FROM alpine:3.4

RUN echo "http://dl-4.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories && \
    apk upgrade --update && \
    apk add --update bash curl && \
    rm -rf /tmp/* /var/cache/apk/*

ADD files-to-deliver che

CMD ["/bin/sh", "/che/che.sh"]
