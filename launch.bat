@ECHO OFF 
REM Get current directory and convert to Unix format.
set f=%~dp0:\=/%&set h=%g::=%&set i=/%h%

REM Trim whitespace at the end of the directory name
for /l %%a in (1,1,100) do if "!i:~-1!"==" " set i=!i:~0,-1!

docker run -v %i%:/che local

bin\test.bat