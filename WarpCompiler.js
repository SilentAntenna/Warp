"use strict";

module.exports = {
    parse: function(source_str){
        let file_stat = {
            content: source_str,
            name: "main",
            pos: 0,
            line: 0,
            column: 0
        };

        let binding = function(pos){
            this.pos = pos;
            this._arr = [];
            this._set = {};
            this.next = null;
            this.add = function(value, symbol){
                if(null == symbol)this._arr.push(value);
                else this._set[symbol] = value;
            }
            return this;
        };

        let expr = function(pos, type){
            this.pos = pos;
            this.value = null;
            this.type = "type";
            this.binding = null;
            return this;
        };

        let lexer_basic = {
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
                ">" : 8, // special 7
                "%" : 9, // comment
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
                                    // char literal
                                    this._regex_char.lastIndex = input.pos + 1;
                                    result = this._regex_char.exec(input.content);
                                    if(null == result){
                                        symbol.content = 0; // illigal char literal
                                        symbol.type = "error";
                                        return symbol;
                                    }
                                    else{
                                        if("\\" == result[0][0]){
                                            let char = this._parse_escapechar(result[0]);
                                            if(undefined == char){
                                                symbol.pos = [input.line, result.index];
                                                symbol.content = 2; // illigal escape character
                                                symbol.type = "error";
                                                return symbol;
                                            }
                                            else symbol.content = char;
                                        }
                                        else symbol.content = result[0];
                                    }
                                    symbol.type = "char";
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
                                            symbol.content = 1; // illigal string literal
                                            symbol.type = "error";
                                            return symbol;
                                        }
                                        else{
                                            if("\\" == result[0][0]){
                                                let char = this._parse_escapechar(result[0]);
                                                if(undefined == char){
                                                    symbol.pos = [input.line, result.index];
                                                    symbol.content = 2; // illigal escape character
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
                                case "<":
                                    this._regex_lt.lastIndex = input.pos;
                                    symbol.content = this._regex_lt.exec(input.content)[0];
                                    symbol.type = "symbol";
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
        };

        let parser = {
            reserved_word: {
                "now" : true,
                "here" : true
            },
            parse: function(file_stat){
                let RetValue = "";
                let stack = [];
                let cur_item = new expr([0, 0], "");
                let popstack = function(){
                    let cmd = stack.pop();
                    let pushed_item = cmd.opd1;
                    switch(cmd.name){
                        case "set":
                        pushed_item.value = cur_expr;
                        break;
                        case "bind":
                        pushed_item.add(cmd.op2, cur_expr);
                        break;
                        case "addbind_L":
                        pushed_item.add();
                        case "addbind_R":
                        pushed_item.add();
                        break;
                    }
                    cur_item = pushed_item;
                }

                let stat = "eb";
                while(true){
                    let lexeme = lexer_basic.get_next(file_stat);
                    if(null == lexeme)break;
                    else if("error" == lexeme.type){
                        RetValue += lexeme.type + ": " + lexeme.content + " [" + lexeme.pos[0] + ", "+lexeme.pos[1] + "]\n";
                        break;
                    }

                    switch(stat){
                        case "eb": // expr begin
                        if("" == lexeme.type){
                            if("(" == lexeme.content){
                                // push stack
                                stat = "bb"; // binding begin
                            }
                            else if("{" == lexeme.content){
                                // push stack
                                stat = "bcb"; // binding capture begin
                            }
                            else if("[" == lexeme.content){
                                // push stack
                                stat = "ab"; // array begin
                            }
                            else{
                                // error
                            }
                        }
                        else if("symbol" == lexeme.content){
                            stat = "se?"; // symbol possibly end
                        }
                        else{
                            stat = "ce?"; // constant possibly end
                        }
                        break;

                        case "bb": // binding begin
                        if("" == lexeme.type){
                            if(")" == lexeme.content){
                                // pop stack
                                stat = "be"; // binding end
                            }
                            else if("{" == lexeme.content){
                                // push stack
                                stat = "bcb"; // binding capture begin
                            }
                            else if("[" == lexeme.content){
                                // push stack
                                stat = "ab"; // array begin
                            }
                            else{
                                // error
                            }
                        }
                        else if("symbol" == lexeme.content){
                            stat = "se?"; // symbol possibly end
                        }
                        else{
                            stat = "ce?"; // constant possibly end
                        }
                        break;
                    }
                    
                    //else if("string" == lexeme.type)RetValue += lexeme.type + ": \"" + lexeme.content + "\" [" + lexeme.pos[0] + ", "+lexeme.pos[1] + "]\n";
                    //else if("char" == lexeme.type)RetValue += lexeme.type + ": \'" + lexeme.content + "\' [" + lexeme.pos[0] + ", "+lexeme.pos[1] + "]\n";
                    //else RetValue += lexeme.type + ": " + lexeme.content + " [" + lexeme.pos[0] + ", "+lexeme.pos[1] + "]\n";
                }
            }
        };
        return RetValue;
    }
}