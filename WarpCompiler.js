"use strict";

module.exports = {
    expr: function(pos, type, value){
        this.pos = pos;
        this.value = value;
        this.type = type;
        this.binding = null;
        return this;
    },
    reserved_word: {
        "$now" : true,
        "$this" : true,
        "$args" : true,
        "$proto" : true
    },
    parsers: {
        main: {
            lexer: {
                _char_table : {
                    "{" : 0,
                    "}" : 0,
                    "[" : 0,
                    "]" : 0,
                    "(" : 0,
                    ")" : 0,
                    "'" : "'", // char
                    "\"" : "\"", // string
                    ":" : 0,
                    "," : 0,
                    "." : ".", // special 3
                    "+" : "+", // special 4
                    "-" : "-", // special 5
                    "*" : 1,
                    "/" : 1,
                    "=" : 1,
                    "<" : "<", // special 6
                    ">" : ">", // special 7
                    "%" : "%", // comment
                },
                _regex_skipblank: /\S|\r\n?|\n\r?/g,
                _regex_symbol: /[^\{\}\[\]\(\)'":,\.\+\-\*\/\=<>%\s]+\{?/y,
                _regex_char: /(?:\\(?:[^uU]|[uU][0-9a-fA-F]{0,4})|[^\\'\r\n])(?=')/y,
                _regex_string: /\\(?:[^uU]|[uU][0-9a-fA-F]{0,4})|(?:[^\\"\r\n])*(?:\r\n?|\n\r?|\\|(?="))/y,
                _regex_numeral: /0x[\da-f]+|(?:0|[1-9]\d*)(?:\.\d*)?(?:e[\+\-]?\d+)?/iy,
                _regex_dot: /\.(?:\.\.|\d+(?:e[\+\-]?\d+)?)?/iy,
                _regex_plus: /\+(?:0x[\da-f]+|(?:0|[1-9]\d*)(?:\.\d*)?(?:e[\+\-]?\d+)?|\.\d+(?:e[\+\-]?\d+)?)?/iy,
                _regex_minus: /\-(?:>|0x[\da-f]+|(?:0|[1-9]\d*)(?:\.\d*)?(?:e[\+\-]?\d+)?|\.\d+(?:e[\+\-]?\d+)?)?/iy,
                _regex_lt: /<[\=\->]?/y,
                _regex_gt: />\=?/y,
                _regex_comment_line: /\r\n?|\n\r?/g,
                _regex_comment_block: /%%|\r\n?|\n\r?/g,
                _parse_escapechar: function(str){
                    let table = {
                        "'" : "'",
                        "\"" : "\"",
                        "\\" : "\\",
                        "/" : "/",
                        "b" : "\b",
                        "f" : "\f",
                        "n" : "\n",
                        "r" : "\r",
                        "t" : "\t"
                    };
    
                    let char = str[1].toLowerCase();
                    if("u" == char){
                        if(str.length <= 2)return undefined;
                        let codepoint = 0;
                        for(let i=2; i < str.length; i++){
                            let digit;
                            if(str[i] >= '0' && str[i] <= '9')digit = str[i] - '0';
                            else if(str[i] >= 'a' && str[i] <= 'f')digit = str[i] - 'a' + 10;
                            else if(str[i] >= 'A' && str[i] <= 'F')digit = str[i] - 'A' + 10;
                            else return undefined;
    
                            codepoint = codepoint * 16 + digit;
                        }
                        return String.fromCodePoint(codepoint);
                    }
                    else return table[char];
                },
                get_next: function(input){
                    while(true){
                        this._regex_skipblank.lastIndex = input.pos;
                        let result = this._regex_skipblank.exec(input.content);
                        if(null == result)return null;
                        else{
                            if("\r" == result[0][0] || "\n" == result[0][0]){
                                input.line++;
                                input.column = 0;
                                input.pos = result.index + result[0].length;
                            }
                            else{
                                input.column += result.index - input.pos;
                                input.pos = result.index;
                                if("0" <= result[0][0] && "9" >= result[0][0]){
                                    // number literal
                                    let symbol = {
                                        content: null,
                                        pos: [input.line, input.column],
                                        type: null,
                                    };
    
                                    this._regex_numeral.lastIndex = input.pos;
                                    symbol.content = this._regex_numeral.exec(input.content)[0];
                                    input.column += symbol.content.length;
                                    input.pos += symbol.content.length;
    
                                    if(-1 != symbol.content.search(/[\.eE]/)){
                                        symbol.type = "float";
                                        symbol.content = parseFloat(symbol.content);
                                    }
                                    else{
                                        symbol.type = "int";
                                        symbol.content = parseInt(symbol.content);
                                    }
                                    return symbol;
                                }
                                else{
                                    let state = this._char_table[result[0][0]];
                                    let symbol = {
                                        content: null,
                                        pos: [input.line, input.column],
                                        type: null
                                    };
                                    
                                    switch(state){
                                    case undefined:
                                        this._regex_symbol.lastIndex = input.pos;
                                        symbol.content = this._regex_symbol.exec(input.content)[0];
                                        input.column += symbol.content.length;
                                        input.pos += symbol.content.length;
    
                                        if("{" == symbol.content[symbol.content.length - 1]){
                                            symbol.type = "lexcall";
                                            symbol.content = symbol.content.substring(0, symbol.content.length - 1);
                                        }
                                        else symbol.type = "symbol";
                                    
                                        return symbol;
                                    case 0:
                                        symbol.content = result[0][0];
                                        symbol.type = "";
                                        input.column += 1;
                                        input.pos += 1;
                                        return symbol;
                                    case 1:
                                        symbol.content = result[0][0];
                                        symbol.type = "symbol";
                                        input.column += 1;
                                        input.pos += 1;
                                        return symbol;
                                    case "'":
                                        // char literal, considered as int
                                        this._regex_char.lastIndex = input.pos + 1;
                                        result = this._regex_char.exec(input.content);
                                        if(null == result){
                                            symbol.content = 1; // illigal char literal
                                            symbol.type = "error";
                                            return symbol;
                                        }
                                        else{
                                            if("\\" == result[0][0]){
                                                let char = this._parse_escapechar(result[0]);
                                                if(undefined == char){
                                                    symbol.pos = [input.line, result.index];
                                                    symbol.content = 3; // illigal escape character
                                                    symbol.type = "error";
                                                    return symbol;
                                                }
                                                else symbol.content = char.codePointAt(0);
                                            }
                                            else symbol.content = result[0].codePointAt(0);
                                        }
                                        symbol.type = "int";
                                        input.column += result[0].length + 2;
                                        input.pos += result[0].length + 2;
                                        return symbol;
                                    case "\"":
                                        // string literal
                                        symbol.content = "";
                                        this._regex_string.lastIndex = input.pos + 1;
                                        while(true){
                                            result = this._regex_string.exec(input.content);
                                            if(null == result){
                                                symbol.content = 2; // illigal string literal
                                                symbol.type = "error";
                                                return symbol;
                                            }
                                            else{
                                                if("\\" == result[0][0]){
                                                    let char = this._parse_escapechar(result[0]);
                                                    if(undefined == char){
                                                        symbol.pos = [input.line, result.index];
                                                        symbol.content = 3; // illigal escape character
                                                        symbol.type = "error";
                                                        return symbol;
                                                    }
                                                    else{
                                                        symbol.content += char;
                                                        input.column += result.index + result[0].length - input.pos;
                                                        input.pos = result.index + result[0].length;
                                                    }
                                                }
                                                else if(result[0].length > 0 && ("\r" == result[0][result[0].length - 1] || "\n" == result[0][result[0].length - 1])){
                                                    symbol.content += result[0];
                                                    input.line++;
                                                    input.column = 0;
                                                    input.pos = result.index + result[0].length;
                                                }
                                                else if(result[0].length > 0 && "\\" == result[0][result[0].length - 1]){
                                                    symbol.content += result[0].substring(0, result[0].length - 1);
                                                    input.column += result.index + result[0].length - 1 - input.pos;
                                                    input.pos = result.index + result[0].length - 1;
                                                    this._regex_string.lastIndex = input.pos;
                                                }
                                                else{
                                                    symbol.content += result[0];
                                                    symbol.type = "string";
                                                    input.column += result.index + result[0].length + 1 - input.pos;
                                                    input.pos = result.index + result[0].length + 1;
                                                    return symbol;
                                                }
                                            }
                                        }
                                    case ".":
                                        this._regex_dot.lastIndex = input.pos;
                                        symbol.content = this._regex_dot.exec(input.content)[0];
                                        input.column += symbol.content.length;
                                        input.pos += symbol.content.length;
                                        if(-1 == symbol.content.search(/\d/))symbol.type = "";
                                        else{
                                            symbol.type = "float";
                                            symbol.content = parseFloat(symbol.content);
                                        }
                                        return symbol;
                                    case "+":
                                        this._regex_plus.lastIndex = input.pos;
                                        symbol.content = this._regex_plus.exec(input.content)[0];
                                        input.column += symbol.content.length;
                                        input.pos += symbol.content.length;
                                        if(-1 == symbol.content.search(/\d/))symbol.type = "symbol";
                                        else if(-1 != symbol.content.search(/[\.eE]/)){
                                            symbol.type = "float";
                                            symbol.content = parseFloat(symbol.content);
                                        }
                                        else{
                                            symbol.type = "int";
                                            symbol.content = parseInt(symbol.content);
                                        }
                                        return symbol;
                                    case "-":
                                        this._regex_minus.lastIndex = input.pos;
                                        symbol.content = this._regex_minus.exec(input.content)[0];
                                        input.column += symbol.content.length;
                                        input.pos += symbol.content.length;
                                        if("->" == symbol.content)symbol.type = "";
                                        else if(-1 == symbol.content.search(/\d/))symbol.type = "symbol";
                                        else if(-1 != symbol.content.search(/[\.eE]/)){
                                            symbol.type = "float";
                                            symbol.content = parseFloat(symbol.content);
                                        }
                                        else{
                                            symbol.type = "int";
                                            symbol.content = parseInt(symbol.content);
                                        }
                                        return symbol;
                                    case "<":
                                        this._regex_lt.lastIndex = input.pos;
                                        symbol.content = this._regex_lt.exec(input.content)[0];
                                        if("<-" == symbol.content)symbol.type = ""; else symbol.type = "symbol";
                                        input.column += symbol.content.length;
                                        input.pos += symbol.content.length;
                                        return symbol;
                                    case ">":
                                        this._regex_gt.lastIndex = input.pos;
                                        symbol.content = this._regex_gt.exec(input.content)[0];
                                        symbol.type = "symbol";
                                        input.column += symbol.content.length;
                                        input.pos += symbol.content.length;
                                        return symbol;
                                    case "%":
                                        // comment
                                        if(input.content.length > input.pos + 1 && "%" == input.content[input.pos + 1]){
                                            // block comment
                                            this._regex_comment_block.lastIndex = input.pos + 2;
                                            while(true){
                                                result = this._regex_comment_block.exec(input.content);
                                                if(null == result)return null;
                                                else if("%%" == result[0]){
                                                    input.column += result.index + result[0].length - input.pos;
                                                    input.pos = result.index + result[0].length;
                                                    break;
                                                }
                                                else{
                                                    input.line++;
                                                    input.column = 0;
                                                    input.pos = result.index + result[0].length;
                                                    this._regex_comment_block.lastIndex = input.pos;
                                                }
                                            }
                                        }
                                        else{
                                            // line comment
                                            this._regex_comment_line.lastIndex = input.pos + 1;
                                            result = this._regex_comment_line.exec(input.content);
                                            if(null == result)return null;
                                            else{
                                                input.line++;
                                                input.column = 0;
                                                input.pos = result.index + result[0].length;
                                            }
                                        }
                                        break;
                                    default:
                                        symbol.content = result[0][0];
                                        input.column += result[0].length;
                                        input.pos += result[0].length;
                                        return symbol;
                                    }
                                }
                            }
                        }
                    }
                }
            },
            parse: function(file_stat, compiler){
                let error = null;
                let stack = [];
                let stat = {op:"eb", head_item: null, cur_item: null, lexeme_stack:[]};

                let add_item = function(pos, type, value, dir){
                    let new_item = new compiler.expr(pos, type, value);

                    if(null == dir && "dir" in stat)dir = stat.dir;
                    if(null != dir){
                        if(true == dir)stat.cur_item.binding = new_item;
                        else{
                            new_item.binding = stat.cur_item;
                            stat.head_item = new_item;
                        }
                    }
                    else if(null == stat.head_item)stat.head_item = new_item;
                    stat.cur_item = new_item;
                }
                let expand_shortbind = function(){
                    let temp_head = stat.head_item;
                    popstack();
                    let new_pack = new compiler.expr(stat.cur_item.pos, stat.cur_item.type, stat.cur_item.value);
                    new_pack.binding = temp_head;
                    stat.cur_item.type = "mexp";
                    stat.cur_item.value = new_pack;
                }
                let pushstack = function(){
                    stack.push(stat);
                    stat = {op:"eb", head_item: null, cur_item: null, lexeme_stack:[]};
                }
                let popstack = function(){
                    let prev_stat = stack.pop();
                    switch(prev_stat.op_stack){
                        case "block":
                        prev_stat.cur_item.value.expr = stat.head_item;
                        break;

                        case "pack":
                        if("op_id" in prev_stat)prev_stat.cur_item.value._map.set(prev_stat.op_id, stat.head_item);
                        else prev_stat.cur_item.value._arr.push(stat.head_item);
                        delete prev_stat.op_id;
                        break;
                    }
                    delete prev_stat.op_stack;
                    stat = prev_stat;
                }
                
                while(null == error){
                    let lexeme;
                    if(stat.lexeme_stack.length > 0)lexeme = stat.lexeme_stack.pop();
                    else lexeme = this.lexer.get_next(file_stat);
                    if(null != lexeme && "error" == lexeme.type){
                        error = {id:lexeme.content, pos:lexeme.pos};
                        break;
                    }

                    switch(stat.op){
                        case "eb": // element begin
                        if(null == lexeme){
                            error = {id:0x100, pos:[file_stat.line, file_stat.column]};
                        }
                        else if("" == lexeme.type){
                            if("(" == lexeme.content){
                                add_item(lexeme.pos, "pack", {_arr:[], _map:new Map()});
                                stat.op = "pb"; // pack begin
                            }
                            else if("{" == lexeme.content){
                                add_item(lexeme.pos, "block", {param:[], param_tail_list:null, expr:null});
                                stat.op = "bcb"; // block capture definition begin
                            }
                            else if("[" == lexeme.content){
                                add_item(lexeme.pos, "index", null);
                                stat.op = "ib"; // index begin
                            }
                            else{
                                error = {id:0x101, pos:lexeme.pos, value:lexeme.content};
                            }
                        }
                        else{
                            add_item(lexeme.pos, lexeme.type, lexeme.content);
                            stat.op = "ee"; // element end
                        }
                        break;

                        case "ee": // element end
                        if(null == lexeme){
                            if(stack.length > 0 && stack[stack.length - 1].op_stack == "mexp")expand_shortbind();
                            if(stack.length > 0)error = {id:0x10F, pos:[file_stat.line, file_stat.column]};
                            else error = {id:0x0, pos:[file_stat.line, file_stat.column], value:stat.head_item}; // done.
                        }
                        else if("" == lexeme.type){
                            if("(" == lexeme.content){
                                if(0 == stack.length || stack[stack.length - 1].op_stack != "mexp"){
                                    stat.op_stack = "mexp";
                                    pushstack();
                                }
                                else stat.dir = true;
                                add_item(lexeme.pos, "pack", {_arr:[], _map:new Map()});
                                stat.op = "pb"; // pack begin
                            }
                            else if("[" == lexeme.content){
                                if(0 == stack.length || stack[stack.length - 1].op_stack != "mexp"){
                                    stat.op_stack = "mexp";
                                    pushstack();
                                }
                                else stat.dir = true;
                                add_item(lexeme.pos, "index", null);
                                stat.op = "ib"; // index begin
                            }
                            else if("." == lexeme.content){
                                if(0 == stack.length || stack[stack.length - 1].op_stack != "mexp"){
                                    stat.op_stack = "mexp";
                                    pushstack();
                                }
                                else stat.dir = true;
                                add_item(lexeme.pos, "index", null);
                                stat.op = "ib_dot"; // index begin
                            }
                            else if("," == lexeme.content){
                                if(stack.length > 0 && stack[stack.length - 1].op_stack == "mexp")expand_shortbind();
                                if(0 == stack.length || stack[stack.length - 1].op_stack != "pack")error = {id:0x10B, pos:lexeme.pos};
                                else popstack();
                            }
                            else if(")" == lexeme.content){
                                if(stack.length > 0 && stack[stack.length - 1].op_stack == "mexp")expand_shortbind();
                                if(0 == stack.length || stack[stack.length - 1].op_stack != "pack")error = {id:0x109, pos:lexeme.pos, value:lexeme.content};
                                else{
                                    popstack();
                                    stat.lexeme_stack.push(lexeme);
                                }
                            }
                            else if("}" == lexeme.content){
                                if(stack.length > 0 && stack[stack.length - 1].op_stack == "mexp")expand_shortbind();
                                if(0 == stack.length || stack[stack.length - 1].op_stack != "block")error = {id:0x109, pos:lexeme.pos, value:lexeme.content};
                                else popstack();
                            }
                            else if("->" == lexeme.content){
                                if(stack.length > 0 && stack[stack.length - 1].op_stack == "mexp")expand_shortbind();
                                if("dir" in stat && stat.dir != true)error = {id:0x102, pos:lexeme.pos};
                                else{
                                    stat.dir = true;
                                    stat.op = "eb"; // element begin
                                }
                            }
                            else if("<-" == lexeme.content){
                                if(stack.length > 0 && stack[stack.length - 1].op_stack == "mexp")expand_shortbind();
                                if("dir" in stat && stat.dir != false)error = {id:0x102, pos:lexeme.pos};
                                else{
                                    stat.dir = false;
                                    stat.op = "eb"; // element begin
                                }
                            }
                            else{
                                error = {id:0x103, pos:lexeme.pos, value:lexeme.content};
                            }
                        }
                        else {
                            error = {id:0x104, pos:lexeme.pos};
                        }
                        break;

                        case "bcb": // block capture definition begin
                        if(null == lexeme){
                            error = {id:0x105, pos:[file_stat.line, file_stat.column]};
                        }
                        else if("" == lexeme.type){
                            if(":" == lexeme.content){
                                stat.op = "ee";
                                stat.op_stack = "block";
                                pushstack();
                            }
                            else{
                                error = {id:0x107, pos:lexeme.pos, value:lexeme.content};
                            }
                        }
                        else if("symbol" == lexeme.type){
                            if(lexeme.content in compiler.reserved_word)error = {id:0x10A, pos:lexeme.pos, value:lexeme.content};
                            else{
                                stat.cur_item.value.param.push(lexeme.content);
                                stat.op = "bce?"; // block capture definition possible end
                            }
                        }
                        else{
                            error = {id:0x106, pos:lexeme.pos};
                        }
                        break;

                        case "bce?": // block capture definition possible end
                        if(null == lexeme){
                            error = {id:0x105, pos:[file_stat.line, file_stat.column]};
                        }
                        else if("" == lexeme.type){
                            if("," == lexeme.content){
                                stat.op = "bcb"; // block capture definition begin
                            }
                            else if("..." == lexeme.content){
                                stat.cur_item.value.param_tail_list = stat.cur_item.value.param.pop();
                                stat.op = "bce"; // block capture definition end
                            }
                            else if(":" == lexeme.content){
                                stat.op = "ee";
                                stat.op_stack = "block";
                                pushstack();
                            }
                            else{
                                error = {id:0x107, pos:lexeme.pos, value:lexeme.content};
                            }
                        }
                        else{
                            error = {id:0x107, pos:lexeme.pos};
                        }
                        break;

                        case "bce": // block capture definition possible end
                        if(null == lexeme){
                            error = {id:0x105, pos:[file_stat.line, file_stat.column]};
                        }
                        else if("" == lexeme.type){
                            if(":" == lexeme.content){
                                stat.op = "ee"; // element end
                                stat.op_stack = "block";
                                pushstack();
                            }
                            else{
                                error = {id:0x108, pos:lexeme.pos};
                            }
                        }
                        else{
                            error = {id:0x108, pos:lexeme.pos};
                        }
                        break;

                        case "pb": // pack begin
                        if(null == lexeme){
                            error = {id:0x105, pos:[file_stat.line, file_stat.column]};
                        }
                        else if("" == lexeme.type){
                            if(")" == lexeme.content){
                                stat.op = "ee"; // element end
                            }
                            else{
                                stat.op = "pb"; // pack begin
                                stat.op_stack = "pack";
                                pushstack();
                                stat.lexeme_stack.push(lexeme);
                            }
                        }
                        else if("symbol" == lexeme.type){
                            let lexeme_next;
                            if(stat.lexeme_stack.length > 0)lexeme_next = stat.lexeme_stack.pop();
                            else lexeme_next = this.lexer.get_next(file_stat);
                            if(null == lexeme){
                                error = {id:0x105, pos:[file_stat.line, file_stat.column]};
                            }
                            else if("error" == lexeme_next.type){
                                error = {id:lexeme_next.content, pos:lexeme_next.pos};
                            }
                            else if("" == lexeme_next.type && ":" == lexeme_next.content){
                                if(lexeme.content in compiler.reserved_word)error = {id:0x10A, pos:lexeme.pos, value:lexeme.content};
                                else{
                                    stat.op = "pb"; // pack begin
                                    stat.op_stack = "pack";
                                    stat.op_id = lexeme.content;
                                    pushstack();
                                }
                            }
                            else{
                                stat.op = "pb"; // pack begin
                                stat.op_stack = "pack";
                                pushstack();
                                stat.lexeme_stack.push(lexeme_next);
                                stat.lexeme_stack.push(lexeme);
                            }
                        }
                        else{
                            stat.op = "pb"; // pack begin
                            stat.op_stack = "pack";
                            pushstack();
                            stat.lexeme_stack.push(lexeme);
                        }
                        break;

                        case "ib": // index begin
                        if(null == lexeme){
                            error = {id:0x105, pos:[file_stat.line, file_stat.column]};
                        }
                        else if("symbol" == lexeme.type){
                            stat.cur_item.value = lexeme.content;
                            stat.op = "ie"; // index end
                        }
                        else if("int" == lexeme.type){
                            stat.cur_item.value = lexeme.content;
                            stat.op = "ie"; // index end
                        }
                        else{
                            error = {id:0x10C, pos:lexeme.pos};
                        }
                        break;

                        case "ib_dot": // index begin
                        if(null == lexeme){
                            error = {id:0x105, pos:[file_stat.line, file_stat.column]};
                        }
                        else if("symbol" == lexeme.type){
                            stat.cur_item.value = lexeme.content;
                            stat.op = "ee"; // index end
                        }
                        else{
                            error = {id:0x10E, pos:lexeme.pos};
                        }
                        break;

                        case "ie": // index end
                        if(null == lexeme){
                            error = {id:0x105, pos:[file_stat.line, file_stat.column]};
                        }
                        else if("" == lexeme.type){
                            if("]" == lexeme.content){
                                stat.op = "ee"; // element end
                            }
                            else{
                                error = {id:0x10D, pos:lexeme.pos};
                            }
                        }
                        else{
                            error = {id:0x10D, pos:lexeme.pos};
                        }
                        break;
                    }
                }
                return error;
            }
        }
    },
    parse: function(source_str){
        let file_stat = {
            content: source_str,
            name: "main",
            pos: 0,
            line: 0,
            column: 0
        };
        return this.parsers.main.parse(file_stat, this);
    },
    err_to_string: function(err){
        let result = "";
        if(err.id && 0 == err.id)result = "Done."
        else if(err.constructor != this.expr){
            if(err.id > 0x100)result = "Parser error"; else result = "Lexer error"; 
            result += ` 0x${err.id.toString(16).toUpperCase()}[${err.pos[0] + 1},${err.pos[1] + 1}]: `;
            switch(err.id){
                case 0x1: result += "Illigal char literal."; break;
                case 0x2: result += "Illigal string literal."; break;
                case 0x3: result += "Illigal escape character."; break;
                case 0x100: result += "Empty expression."; break;
                case 0x101: result += `Cannot start an element with \"${err.value}\".`; break;
                case 0x102: result += "The binding direction must be the same in an expression."; break;
                case 0x103: result += `Cannot have \"${err.value}\" after an constant.`; break;
                case 0x104: result += "A constant cannot appear right after another one."; break;
                case 0x105: result += "Unexpected end of the source."; break;
                case 0x106: result += "A binding capture definition only accept symbols."; break;
                case 0x107: result += "A binding capture definition can only contain symbols separated by commas."; break;
                case 0x108: result += "A binding capture definition must end after \"...\"."; break;
                case 0x109: result += `Unexpected bracket \"${err.value}\".`; break;
                case 0x10A: result += `Trying to redefine reserved keyword \"${err.value}\".`; break;
                case 0x10B: result += "Unexpected comma."; break;
                case 0x10C: result += "An index must be expressed with either an integer or a symbol."; break;
                case 0x10D: result += "An index must end with a \"]\""; break;
                case 0x10E: result += "A dot-form index can only be a symbol index."; break;
                case 0x10F: result += "Unclosed bracket found."; break;
                default: break;
            }
        }
        else result = "Runtime error.";
        return result;
    },
    toString: function(expr, mexp = false){
        let result = "";
        while(true){
            if(expr.type == "error" || (expr.type.value && expr.type.value.fn === this.global_fn.error.fn)){
                result += `error\{0x${expr.value.toString(16).toUpperCase()}@[${expr.pos[0]+1},${expr.pos[1]+1}]\}`;
            }
            else if(expr.type == "index" || (expr.type.value && expr.type.value.fn === this.global_fn.index.fn)){
                result += "[" + expr.value.toString() + "]";
            }
            else if(expr.type == "mexp"){
                let cur_expr = expr.value;
                result += this.toString(cur_expr, true);
            }
            else if(expr.type == "block" || (expr.type.value && expr.type.value.fn === this.global_fn.block.fn)){
                result += "{";
                if("function" == typeof(expr.value)){
                    result += ":delegate{...}"
                }
                else{
                    let not_first = false;
                    for(let item of expr.value.param){
                        if(not_first)result += ",";
                        result += item;
                        not_first = true;
                    }
                    if(expr.value.param_tail_list){
                        if(not_first)result += ",";
                        result += expr.value.param_tail_list + "...";
                    }
                    result += ":";
                    result += this.toString(expr.value.expr);
                }
                result += "}";
            }
            else if(expr.type == "pack" || (expr.type.value && expr.type.value.fn === this.global_fn.pack.fn)){
                result += "(";
                let not_first = false;
                for(let item of expr.value._arr){
                    if(not_first)result += ",";
                    result += this.toString(item);
                    not_first = true;
                }
                for(let [key, value] of expr.value._map){
                    if(not_first)result += ",";
                    result += key + ":";
                    result += this.toString(value);
                    not_first = true;
                }
                result += ")";
            }
            else if(expr.type == "type" || (expr.type.value && expr.type.value.fn === this.global_fn.type.fn)){
                if("name" in expr.value)result += expr.value.name;
                else{
                    result += "type(proto:";
                    result += this.toString(expr.value.proto);
                    result += ",";
                    result += this.toString(expr.value.expr);
                    result += ")";
                }
            }
            else if(expr.type == "float" || (expr.type.value && expr.type.value.fn === this.global_fn.float.fn)){
                result += expr.value.toExponential();
            }
            else if(expr.type == "string" || (expr.type.value && expr.type.value.fn == this.global_fn.string.fn)){
                let tmpstr = expr.value.replace("\"","\\\"");
                tmpstr = tmpstr.replace("\b","\\b");
                result += "\"" + tmpstr + "\"";
            }
            else if(expr.type.value && !("name" in expr.type.value)){
                result += "custom_type{...}"
            }
            else result += expr.value.toString();

            if(null != expr.binding){
                expr = expr.binding;
                if(!mexp)result += "->";
            }
            else break;
        }
        return result;
    },
    _type_wrapper: function*(type, args){
        let result = yield [type.value.expr, args];
        if(result.type != this.root_scope.pack || result.value._map.size > 0 || result.value._arr.length != 2)return new this.env.expr([0,0], this.root_scope.error, 0x208); // operation failed.
        else return new this.env.expr([0,0], type, result.value._arr);
    },
    _def_type_convert: function(type, expr){
        while(true){
            if(expr.type === type)return expr;
            if(expr.type === this.root_scope.block)return null;
            if("expr" in expr.type.value)expr = expr.value[1];
            else expr = this.root_scope.fail;
        }
    },
    global_fn : {
        // types
        "block": {
            fn: function(expr){
                let def_convert = this.env._def_type_convert.apply(this, [this.root_scope.block, expr]);
                if(null != def_convert)return def_convert;
                else return new this.env.expr([0,0], this.root_scope.error, 0x208); // operation failed.
            },
            proto: "block"
        },
        "type": {
            fn: function(expr, proto){
                let def_convert = this.env._def_type_convert.apply(this, [this.root_scope.type, expr]);
                if(null != def_convert)return def_convert;
                else{
                    if(this.root_scope.error == proto.type)proto = this.root_scope.block;
                    if(this.root_scope.block != expr.type || this.root_scope.type != proto.type)return new this.env.expr([0,0], this.root_scope.error, 0x208); // operation failed.
                    else{
                        let expr_value_new;
                        if("function" == typeof(expr.value))expr_value_new = expr.value;
                        else{
                            expr_value_new = {};
                            for(let name in expr.value)expr_value_new[name] = expr.value[name];
                            let scope_new = {vars:{$proto:proto}, prev:expr_value_new.scope};
                            expr_value_new.scope = scope_new;
                        }
                        return new this.env.expr([0,0], this.root_scope.type, {fn:this.env._type_wrapper, proto:proto, expr:new this.env.expr([0,0], this.root_scope.block, expr_value_new)});
                    }
                }
            },
            proto: "block",
            param_decl: [null, "proto"]
        },
        "error": {
            fn: function(expr){
                let def_convert = this.env._def_type_convert.apply(this, [this.root_scope.error, expr]);
                if(null != def_convert)return def_convert;
                else return new this.env.expr([0,0], this.root_scope.error, 0x208); // operation failed.
            },
            proto: "block"
        },
        "pack": {
            fn: function(expr){
                let def_convert = this.env._def_type_convert.apply(this, [this.root_scope.pack, expr]);
                if(null != def_convert)return def_convert;
                else return new this.env.expr([0,0], this.root_scope.pack, {_arr:[expr],_map:new Map()}); // operation failed.
            },
            proto: "block"
        },
        "int": {
            fn: function(expr){
                let def_convert = this.env._def_type_convert.apply(this, [this.root_scope.int, expr]);
                if(null != def_convert)return def_convert;
                else if(this.root_scope.float == expr.type)return new this.env.expr([0,0], this.root_scope.int, Math.floor(expr.value));
                else if(this.root_scope.string == expr.type){
                    let int = parseInt(expr.value);
                    return new this.env.expr([0,0], this.root_scope.int, int);
                }
                else return new this.env.expr([0,0], this.root_scope.error, 0x208); // operation failed.
            },
            proto: "block"
        },
        "float": {
            fn: function(expr){
                let def_convert = this.env._def_type_convert.apply(this, [this.root_scope.float, expr]);
                if(null != def_convert)return def_convert;
                else if(this.root_scope.int == expr.type)return new this.env.expr([0,0], this.root_scope.float, expr.value);
                else if(this.root_scope.string == expr.type){
                    let float = parseFloat(expr.value);
                    return new this.env.expr([0,0], this.root_scope.float, float);
                }
                else return new this.env.expr([0,0], this.root_scope.error, 0x208); // operation failed.
            },
            proto: "block"
        },
        "bool": {
            fn: function(expr){
                let def_convert = this.env._def_type_convert.apply(this, [this.root_scope.bool, expr]);
                if(null != def_convert)return def_convert;
                else if(this.root_scope.int == expr.type)return new this.env.expr([0,0], this.root_scope.bool, expr.value != 0);
                else if(this.root_scope.string == expr.type){
                    if("true" == expr.value)return new this.env.expr([0,0], this.root_scope.bool, true);
                    else if("false" == expr.value)return new this.env.expr([0,0], this.root_scope.bool, false);
                    else return new this.env.expr([0,0], this.root_scope.error, 0x208); // operation failed.
                }
                else return new this.env.expr([0,0], this.root_scope.error, 0x208); // operation failed.
            },
            proto: "block"
        },
        "string": {
            fn: function(expr){
                let def_convert = this.env._def_type_convert.apply(this, [this.root_scope.string, expr]);
                if(null != def_convert)return def_convert;
                else return new this.env.expr([0,0], this.root_scope.string, this.env.toString(expr)); // operation failed.
            },
            proto: "block"
        },
        "index": {
            fn: function(expr){
                let def_convert = this.env._def_type_convert.apply(this, [this.root_scope.index, expr]);
                if(null != def_convert)return def_convert;
                else if(this.root_scope.int == expr.type)return new this.env.expr([0,0], this.root_scope.index, expr.value);
                else if(this.root_scope.string == expr.type){
                    let result = /^[^\d\{\}\[\]\(\)'":,\.\+\-\*\/\=<>%\s][^\{\}\[\]\(\)'":,\.\+\-\*\/\=<>%\s]*$/.test(expr.value);
                    if(result)return new this.env.expr([0,0], this.root_scope.index, expr.value);
                    else return new this.env.expr([0,0], this.root_scope.error, 0x208); // operation failed.
                }
                else return new this.env.expr([0,0], this.root_scope.error, 0x208); // operation failed.
            },
            proto: "block"
        },

        // functions
        "fail": function(){
            return new this.env.expr([0,0], this.root_scope.error, 0x208); // operation failed.
        },
        "if": {
            fn: function*(cond, expr_then, expr_else){
                if(this.root_scope.bool == cond.type){
                    if(false == cond.value){
                        if(this.root_scope.block == expr_else.type)return yield [expr_else, new this.env.expr([0,0], this.root_scope.pack, {_arr:[],_map:new Map()})];
                        else return expr_else;
                    }
                    else{
                        if(this.root_scope.block == expr_then.type)return yield [expr_then, new this.env.expr([0,0], this.root_scope.pack, {_arr:[],_map:new Map()})];
                        else return expr_then;
                    }
                }
                else return new this.env.expr([0,0], this.root_scope.error, 0x208); // operation failed.
            },
            param_decl: [null, "then", "else"]
        },
        "typeof": function(expr){ return expr.type; },
        "is": function(a, b){
            if(a.type !== b.type || this.root_scope.type !== a.type)return new this.env.expr([0,0], this.root_scope.error, 0x208); // operation failed.
            else{
                let cur_type = a;
                while(true){
                    if(cur_type === b)return new this.env.expr([0,0], this.root_scope.bool, true);
                    if(cur_type === cur_type.value.proto)break;
                    cur_type = cur_type.value.proto;
                }
                return new this.env.expr([0,0], this.root_scope.bool, false);
            }
        },
        "=": function(a, b){
            if(a.type !== b.type)return new this.env.expr([0,0], this.root_scope.bool, false);
            else if(this.root_scope.block === a.type.value.proto)return new this.env.expr([0,0], this.root_scope.bool, a.value === b.value);
            else return new this.env.expr([0,0], this.root_scope.bool, false);
        },
        "+": function(a, b){
            if(this.root_scope.int == a.type && this.root_scope.int == b.type)return new this.env.expr([0,0], this.root_scope.int, a.value + b.value);
            else if((this.root_scope.int == a.type || this.root_scope.float == a.type) && (this.root_scope.int == b.type || this.root_scope.float == b.type))return new this.env.expr([0,0], this.root_scope.float, a.value + b.value);
            else if(this.root_scope.string == a.type && this.root_scope.string == b.type)return new this.env.expr([0,0], this.root_scope.string, a.value + b.value);
            else return new this.env.expr([0,0], this.root_scope.error, 0x208); // operation failed.
        },
        "-": function(a, b){
            if(this.root_scope.int == a.type && this.root_scope.int == b.type)return new this.env.expr([0,0], this.root_scope.int, a.value - b.value);
            else if((this.root_scope.int == a.type || this.root_scope.float == a.type) && (this.root_scope.int == b.type || this.root_scope.float == b.type))return new this.env.expr([0,0], this.root_scope.float, a.value - b.value);
            else return new this.env.expr([0,0], this.root_scope.error, 0x208); // operation failed.
        },
        "*": function(a, b){
            if(this.root_scope.int == a.type && this.root_scope.int == b.type)return new this.env.expr([0,0], this.root_scope.int, a.value * b.value);
            else if((this.root_scope.int == a.type || this.root_scope.float == a.type) && (this.root_scope.int == b.type || this.root_scope.float == b.type))return new this.env.expr([0,0], this.root_scope.float, a.value * b.value);
            else return new this.env.expr([0,0], this.root_scope.error, 0x208); // operation failed.
        },
        "/": function(a, b){
            if(this.root_scope.int == a.type && this.root_scope.int == b.type)return new this.env.expr([0,0], this.root_scope.int, Math.floor(a.value / b.value));
            else if((this.root_scope.int == a.type || this.root_scope.float == a.type) && (this.root_scope.int == b.type || this.root_scope.float == b.type))return new this.env.expr([0,0], this.root_scope.float, a.value / b.value);
            else return new this.env.expr([0,0], this.root_scope.error, 0x208); // operation failed.
        }
    },
    add_global_fn: function(name, fn, param_decl){
        if(null != param_decl)global_fn[name] = {"fn":fn, "param_decl":param_decl};
        else global_fn[name] = fn;
    },
    eval: function(expr){
        let compiler = this;
        let cc = {
            env: this,
            root_scope: {
                true: new this.expr([0,0], "bool", true),
                false: new this.expr([0,0], "bool", false)
            },
            scope: {},
            stack: [],
            op1: null,
            op2: null
        }

        let fn_now = function(expr){
            if((cc.root_scope.index != expr.type && "symbol" != expr.type) || "string" != typeof(expr.value))return new compiler.expr(expr.pos, cc.root_scope.error, 0x200); // a scope can only resolve a string-type index.
            let scope = this;
            do{
                if(expr.value in scope.vars)return scope.vars[expr.value];
                scope = scope.prev;
            }while(undefined != scope);
            return new compiler.expr(expr.pos, cc.root_scope.error, 0x201); // cannot resolve the given index.
        };

        cc.scope.vars = cc.root_scope;
        cc.scope.vars.$now = new this.expr([0,0], "block", fn_now);
        cc.scope.vars.$now.value.scope = cc.scope;

        for(let name in this.global_fn){
            if("object" == typeof(this.global_fn[name])){
                let item = this.global_fn[name];
                if("proto" in item){
                    cc.root_scope[name] = new this.expr([0,0], "type", {fn:item.fn, proto:item.proto, name:name});
                    if("param_decl" in item)cc.root_scope[name].value.fn.param_decl = item.param_decl;
                }
                else{
                    cc.root_scope[name] = new this.expr([0,0], "block", item.fn);
                    cc.root_scope[name].value.param_decl = item.param_decl;
                }
            }
            else cc.root_scope[name] = new this.expr([0,0], "block", this.global_fn[name]);
        }

        // types
        for(let name in cc.root_scope){
            if("type" == cc.root_scope[name].type)cc.root_scope[name].value.proto = cc.root_scope[cc.root_scope[name].value.proto];
            cc.root_scope[name].type = cc.root_scope[cc.root_scope[name].type];
        }

        let call = function(){
            let callee;
            if("expr" in cc.op1.type.value)callee = cc.op1.value[0]; else callee = cc.op1;
            if(cc.root_scope.block == callee.type || cc.root_scope.type == callee.type){
                if(cc.root_scope.pack != cc.op2.type)cc.op2 = new compiler.expr(cc.op2.pos, cc.root_scope.pack, {_arr:[cc.op2],_map:new Map()});
                
                let func;
                if(cc.root_scope.type == callee.type)func = callee.value.fn;
                else func = callee.value;

                if("function" == typeof(func)){
                    // js function delegate
                    if(fn_now == func)cc.op1 = func.apply(func.scope, cc.op2.value._arr);
                    else if(compiler._type_wrapper == func)cc.op1 = func.apply(cc, [callee, cc.op2]);
                    else if("param_decl" in func){
                        let arr_tmp = [];
                        for(let i=0; i<func.param_decl.length; i++){
                            let param_name = func.param_decl[i];
                            if(null != param_name)arr_tmp.push(cc.op2.value._map.get(param_name));
                            else if(i < cc.op2.value._arr.length)arr_tmp.push(cc.op2.value._arr[i]);
                            else arr_tmp.push(new compiler.expr([0,0], cc.root_scope.error, 0x209)); // required parameter is not provided.
                        }
                        cc.op1 = func.apply(cc, arr_tmp);
                    }
                    else if(func.length > cc.op2.value._arr.length){
                        let arr_tmp = [];
                        for(let item of cc.op2.value._arr)arr_tmp.push(item);
                        for(let i=cc.op2.value._arr.length; i<func.length; i++)arr_tmp.push(new compiler.expr([0,0], cc.root_scope.error, 0x209)); // required parameter is not provided.
                        cc.op1 = func.apply(cc, arr_tmp);
                    }
                    else cc.op1 = func.apply(cc, cc.op2.value._arr);
                    if(cc.op1.constructor != compiler.expr){
                        // then it must be a generator function.
                        let result = cc.op1.next();
                        if(result.done)cc.op1 = result.value;
                        else{
                            cc.stack.push({op:"call_gen", expr:expr, op1:cc.op1}); // must return a function with scope
                            expr = result.value[1];
                            cc.op1 = result.value[0];
                            cc.op2 = null;
                            return true;
                        }
                    }
                    return false;
                }
                else{
                    let scope_new = {vars:{}, prev:func.scope};
                    // bind names
                    let name_count = func.param.length;
                    if(cc.op2.value._arr.length < name_count)name_count = cc.op2.value._arr.length;
                    for(let i=0;i<name_count;i++)scope_new.vars[func.param[i]] = cc.op2.value._arr[i];
                    for(let [key, val] of cc.op2.value._map)scope_new.vars[key] = val;
                    if(null != func.param_tail_list){
                        if(cc.op2.value._arr.length < func.param.length)scope_new.vars[func.param_tail_list] = new compiler.expr(cc.op2.pos, "pack", {_arr:[],_map:new Map()});
                        else scope_new.vars[func.param_tail_list] = new compiler.expr(cc.op2.pos, cc.root_scope.pack, {_arr:cc.op2.value._arr.slice(callee.value.param.length),_map:new Map()});
                    }
                    scope_new.vars.$this = cc.op1;
                    scope_new.vars.$args = cc.op2;
                    scope_new.vars.$now = new compiler.expr([0,0], cc.root_scope.block, fn_now);
                    scope_new.vars.$now.value.scope = scope_new;
                    cc.stack.push({op:"call", expr:expr, scope:cc.scope});
                    expr = func.expr;
                    cc.op1 = null;
                    cc.op2 = null;
                    cc.scope = scope_new;
                    return true;
                }
            }
            else{
                // value type. default binding capture
                let param = null;
                if(cc.root_scope.pack == cc.op2.type){
                    if(cc.op2.value._arr.length > 0)param = cc.op2.value._arr[0];
                }
                else param = cc.op2;

                if(null != param){
                    if(cc.root_scope.string == callee.type){
                        if(cc.root_scope.index != param.type || "number" != typeof(param.value))cc.op1 = new compiler.expr(callee.pos, cc.root_scope.error, 0x202); // a string can only accept an int-type index.
                        else if(expr.value < 0 || expr.value >= callee.value.length)cc.op1 = new compiler.expr(callee.pos, cc.root_scope.error, 0x203);  // the index exceeds string index range.
                        else cc.op1 = new compiler.expr(callee.pos, cc.root_scope.int, callee.value.codePointAt(param.value));
                    }
                    else if(cc.root_scope.pack == callee.type){
                        if(cc.root_scope.index != param.type && cc.root_scope.string != param.type && cc.root_scope.int != param.type)cc.op1 = new compiler.expr(callee.pos, cc.root_scope.error, 0x204); // a pack can only accept an integer, a string or an index.
                        else{
                            if("number" == typeof(param.value)){
                                if(param.value < 0 || param.value >= callee.value._arr.length)cc.op1 = new compiler.expr(callee.pos, cc.root_scope.error, 0x205);  // the index exceeds pack index range.
                                else cc.op1 = callee.value._arr[param.value];
                            }
                            else{
                                if(callee.value._map.has(param.value))cc.op1 = callee.value._map.get(param.value);
                                else cc.op1 = new compiler.expr(callee.pos, cc.root_scope.error, 0x206);  // the required element is not found.
                            }
                        }
                    }
                    else{
                        cc.op1 = new compiler.expr(callee.pos, cc.root_scope.error, 0x207); // a constant cannot accept any parameter.
                    }
                }
                cc.op2 = null;
                return false;
            }
        }

        let call_pack = function(pack){
            let index = null, jmp_dest = null;
            if(pack.value._arr.length > 0){
                index = 0;
                jmp_dest = pack.value._arr[index];
            }
            else if(pack.value._map.size > 0){
                index = pack.value._map[Symbol.iterator]();
                let next_val = index.next();
                index = [next_val.value[0], index];
                jmp_dest = next_val.value[1];
            }
            if(null == index){
                cc.expr = expr;
                expr = null;
            }
            else{
                cc.stack.push({op1:cc.op1, op2:cc.op2, op3:pack, op:"pack", expr:expr, index:index});
                cc.op1 = null;
                cc.op2 = null;
                expr = jmp_dest;
            }
        };

        let call_mexp = function(mexp){
            cc.stack.push({op1:cc.op1, op:"mexp", expr:expr});
            cc.op1 = null;
            cc.op2 = null;
            expr = mexp.value;
        };

        let ret = function(){
            if(0 == cc.stack.length)return true;
            else{
                let stack_frame = cc.stack.pop();

                if("pack" == stack_frame.op){
                    let index = null;
                    if("number" == typeof(stack_frame.index)){
                        stack_frame.op2.value._arr.push(cc.op1);
                        if(stack_frame.op3.value._arr.length > stack_frame.index + 1){
                            index = stack_frame.index + 1;
                            expr = stack_frame.op3.value._arr[index];
                        }
                        else if(stack_frame.op3.value._map.size > 0){
                            index = stack_frame.op3.value._map[Symbol.iterator]();
                            let next_val = index.next();
                            index = [next_val.value[0], index];
                            expr = next_val.value[1];
                        }
                        else expr = null;
                    }
                    else{
                        stack_frame.op2.value._map.set(stack_frame.index[0], cc.op1);
                        let next_val = stack_frame.index[1].next();
                        if(!next_val.done){
                            index = [next_val.value[0], stack_frame.index[1]];
                            expr = next_val.value[1];
                        }
                        else expr = null;
                    }

                    if(null != index){
                        stack_frame.index = index;
                        cc.stack.push(stack_frame);
                        cc.op1 = null;
                        cc.op2 = null;
                        return false;
                    }
                }
                else if("call" == stack_frame.op){
                    cc.op2 = cc.op1;
                    cc.op1 = null;
                    cc.expr = stack_frame.expr;
                    cc.scope = stack_frame.scope;
                    expr = null;
                    return false;
                }
                else if("call_gen" == stack_frame.op){
                    let result = stack_frame.op1.next(cc.op1);
                    if(result.done){
                        cc.op2 = result.value;
                        cc.op1 = null;
                        cc.expr = stack_frame.expr;
                        expr = null;
                        return false;
                    }
                    else{
                        cc.stack.push(stack_frame);
                        expr = result.value[1];
                        cc.op1 = result.value[0];
                        cc.op2 = null;
                    }
                }
                else if("mexp" == stack_frame.op){
                    cc.op2 = cc.op1;
                    cc.op1 = stack_frame.op1;
                    cc.expr = stack_frame.expr;
                    expr = null;
                    return false;
                }

                cc.op1 = stack_frame.op1;
                cc.op2 = stack_frame.op2;
                cc.expr = stack_frame.expr;
                if("scope" in stack_frame)cc.scope = stack_frame.scope;
                expr = null;
                return false;
            }
        }

        while(true){
            // preprocess the current var
            if(null == expr){
                expr = cc.expr;
                delete cc.expr;
            }
            else{
                if("block" == expr.type){
                    // add scope info
                    cc.op2 = new this.expr(expr.pos, cc.root_scope.block);
                    cc.op2.value = {param:expr.value.param, param_tail_list:expr.value.param_tail_list, expr:expr.value.expr, scope:cc.scope};
                }
                else if("pack" == expr.type){
                    cc.op2 = new this.expr(expr.pos, cc.root_scope.pack);
                    cc.op2.value = {_arr:[], _map:new Map()};
                    call_pack(expr);
                    continue;
                }
                else if("mexp" == expr.type){
                    call_mexp(expr);
                    continue;
                }
                else if("symbol" == expr.type){
                    cc.op2 = fn_now.apply(cc.scope, [expr]);
                }
                else{
                    cc.op2 = new this.expr(expr.pos, expr.type, expr.value);
                    if("string" == typeof(cc.op2.type))cc.op2.type = cc.root_scope[cc.op2.type];
                }
            }

            if(null != cc.op1){
                if(call())continue;
            }
            else{
                cc.op1 = cc.op2;
                cc.op2 = null;
            }

            if(null != expr.binding){
                expr = expr.binding;
                continue;
            }
            else{
                if(ret())return cc.op1;
            }
        }
    }
}