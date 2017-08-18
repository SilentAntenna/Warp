"use strict";

const {app, ipcMain} = require('electron')
const path = require('path')
const url = require('url')
const fs = require('fs')
const WarpCompiler = require('./WarpCompiler')

app.on('ready', () => {
    
    app.quit();
})