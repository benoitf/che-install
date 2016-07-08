FROM mhart/alpine-node

RUN echo "http://dl-4.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories && \
    apk upgrade --update && \
    apk add --update docker && \
    rm -rf /tmp/* /var/cache/apk/*

ADD src /src
ADD bin /bin




CMD ["node", "src/che.js"]
