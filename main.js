"use strict";

const {app, ipcMain} = require('electron')
const path = require('path')
const url = require('url')
const fs = require('fs')
const WarpCompiler = require('./WarpCompiler')

let readDir = function(path){
    // this function returns a promise.
    return new Promise(function(resolve, reject){
        fs.readdir(path, { "encoding" : "utf-8" }, function(err,data){
            if(null != err)reject(err);else resolve(data);
        });
    });
};
let getFileStat = function(path){
    // this function returns a promise.
    return new Promise(function(resolve, reject){
        fs.stat(path, function(err,data){
            if(null != err)reject(err);else resolve(data);
        });
    });
};

app.on('ready', async () => {
    let TestDirPath = null;

    let InputParamIndex = process.argv.indexOf('-i') + 1;
    if(0 == InputParamIndex)InputParamIndex = 2;
    if(process.argv.length > InputParamIndex){
        TestDirPath = process.argv[InputParamIndex];
    }

    let DirContent = await readDir(TestDirPath);
    for(let Path_CurDir of DirContent){
        let stat = await getFileStat(TestDirPath + "\\" + Path_CurDir);
        if(stat.isDirectory()){
            let input;
            try{
                input = fs.readFileSync(TestDirPath + "\\" + Path_CurDir + "\\" + "input.txt", "UTF-8");
            }
            catch(e){
                continue;
            }

            let parseResult;
            try{
                parseResult = WarpCompiler.parse(input);
            }
            catch(e){
                console.log(e);
            }

            if(0 == parseResult.id){
                let evalResult = WarpCompiler.eval(parseResult.value);
                try{
                    let output_ref = fs.readFileSync(TestDirPath + "\\" + Path_CurDir + "\\" + "output.txt", "UTF-8");
                    let output_actual = WarpCompiler.toString(evalResult);
                    if(output_ref != output_actual){
                        console.log("Error at case " + Path_CurDir + ".");
                        fs.writeFileSync(TestDirPath + "\\" + Path_CurDir + "\\" + "output_new.txt", output_actual, "UTF-8");
                    }
                }
                catch(e){
                    fs.writeFileSync(TestDirPath + "\\" + Path_CurDir + "\\" + "output_new.txt", WarpCompiler.toString(evalResult), "UTF-8");
                }
            }
            else{
                let error = `error\{0x${parseResult.id.toString(16).toUpperCase()}@[${parseResult.pos[0]+1},${parseResult.pos[1]+1}]${":" + parseResult.value}\}`;
                try{
                    let error_ref = fs.readFileSync(TestDirPath + "\\" + Path_CurDir + "\\" + "error.txt", "UTF-8");
                    if(error_ref !=error){
                        console.log("Error at case \"" + Path_CurDir + "\".");
                        fs.writeFileSync(TestDirPath + "\\" + Path_CurDir + "\\" + "error_new.txt", error, "UTF-8");
                    }
                }
                catch(e){
                    fs.writeFileSync(TestDirPath + "\\" + Path_CurDir + "\\" + "error_new.txt", error, "UTF-8");
                }
            }
        }
    }
    app.quit();
})