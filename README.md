# che-install
A Docker installer to install Eclipse Che
Assumes that Docker is already installed.

This example will move the files in ./files-to-deliver to ./bin/*.
If the user runs this docker command in another directory, the execution files will be delivered into the /bin folder of that directory.
This particular example runs a bin\test.bat after delivery, but this can be modified.

### Windows:
```
git clone http://github.com/tylerjewell/che-install
docker build -t local .
launch
```

### Linux / Mac:
```
git clone http://github.com/tylerjewell/che-install
docker build -t local .
docker run -v $(pwd):/che local
```
