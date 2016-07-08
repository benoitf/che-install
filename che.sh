docker run  -v /var/run/docker.sock:/var/run/docker.sock -v "$PWD":"$PWD" --rm local /bin/che $PWD $1

