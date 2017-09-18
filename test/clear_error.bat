@echo off

setlocal ENABLEDELAYEDEXPANSION

:: install templates
FOR /F "usebackq delims==" %%A IN (`dir /AD /B`) DO (
	del "%%A\output_new.txt"
	del "%%A\error_new.txt"
)
	
@echo Complete.