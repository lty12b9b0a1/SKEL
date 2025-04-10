// const TRACE_FOLDER = ...
const DEBUG = false
const LOG_STEP = 10000 // total steps per log file
const SKIP_STEP = 0 // skip the first n steps

let total_step = -1
let call_stack = []
let msg_queue = []
let object2oid = new Map();
let global_object_idx = 0

let shim_random_seq = []
let shim_print_seq = []

function inTimeCompare(x, x_object_table, y, verified_object_table){
    let tpx_a = typeof x;
    // console.log(x, tpx_a)
    if (x === "undefined"){
        return [true, null];
    }

    if (tpx_a === "string" && !x.startsWith("oid_")){
        if (Number(x) === y || y !== undefined && y.toString() === x || x === y) return [true, null];
        return [false, null];
    }
    
    if (tpx_a === "number") {
        if (y === null) return [false, null];
        if (Math.abs(x - y) < 0.001) return [true, null];
        else return [false, null];
    }
        
    if(tpx_a === "boolean" || x === null) {
        return [x === y, null];
    }

    if (x[0] == "U"){
        return [true, null];
    }
    else if (y === null){ /// This is important. Since later we may access "y.constructor" and "y.name", we need to make sure y is not null
        return [false, null];
    }

    if (tpx_a === "string" && x.startsWith("oid_")){
        if (!object2oid.has(y)){
            var oid = "oid_" + (global_object_idx).toString();
            object2oid.set(y, oid);
            global_object_idx += 1
            if (oid !== x){
                // console.log("Object ID Mismatch", x, oid)
                return [false, "oid mismatch"];
            }
        }
        else{
            var oid = object2oid.get(y);
            if (verified_object_table.hasOwnProperty(oid)){
                return [true, null];
            }
            else{
                if (oid !== x){
                    // console.log("Object ID Mismatch", x, oid)
                    return [false, "oid mismatch"];
                }
                verified_object_table[oid] = true;
            }
        }
    
        var x_obj = x_object_table[x]; 
        if (x_obj[0] === "U" && y === "undefined") return [false, null]; /// Consider as error.
        if (y === undefined) return [false, null];

        if (x_obj[0] === "F") {
            if (x_obj[1] === "<lambda>") {
                return [true, null];
            }
            return [x_obj[1] === y.name, null];
        }   
        else if (x_obj[0] === "L") {
            if (y.constructor === Array && x_obj[1] === y.length) {
                for (let i = 0; i < x_obj[1]; i++) {
                    var [eq, rs] = inTimeCompare(x_obj[2][i], x_object_table, y[i], verified_object_table)
                    if (!eq) {
                        return [false, null];
                    }
                }
                return [true, null];
            }
            else{
                return [false, null];
            }
        }
        else if (x_obj[0] === "SET") {
            if (y.constructor === Set && x_obj[1].length === y.size) {
                for (let v of x_obj[1]) {
                    if (!y.has(v)) {
                        return [false, null];
                    }
                }
                return [true, null];
            }
            else{
                return [false, null];
            }
        }
        else if (x_obj[0] === "D") {
            if (y.constructor === Object) {
                for (let k of x_obj[1]) {
                    if (!(typeof k[0] === "string" && k[0].startsWith("oid_")) && k[0] !== "U"){ /// Complex type should not be the dict key 
                        var [eq, rs] = inTimeCompare(k[1], x_object_table, y[k[0]], verified_object_table);
                    }
                    else{
                        var eq = true
                    }
                    if (!eq) {
                        return [false, null];
                    }
                }
                return [true, null];
            }
            else{
                return [false, null];
            }
        }
        else{
            return [true, null];
        }
    }
    return [true, null];
}

function _instrument_random_shim(min, max) {
    if (total_step >= SKIP_STEP){
        shim_random_seq.push([min, max])
    }
    return user_randint(min, max)
}

function _instrument_print_shim(...args) {
    if (total_step >= SKIP_STEP){
        var capturedOutput = args.map(arg => String(arg)).join(" ") + "\n";
        shim_print_seq.push(capturedOutput)
    }
    return console.log(...args)
}

function _instrument_begin(_vars, blockId) {
    total_step += 1
    var _from = call_stack.length > 0 ? call_stack[call_stack.length - 1] : "START";
    call_stack.push(blockId);
    var _to = blockId;
    if (total_step < SKIP_STEP){
        return
    }
    _compare_trace("Call", blockId, _from, _to, _vars, null)
}

function _instrument_throw(_err, _vars, blockId) {
    total_step += 1
    var _from = blockId;
    call_stack.pop();
    var _to = call_stack.length > 0 ? call_stack[call_stack.length - 1] : "END";
    if (total_step < SKIP_STEP){
        return
    }
    _compare_trace("Throw", blockId, _from, _to, _vars, _err.message)
}

function _instrument_return(_ret, _vars, blockId) {
    total_step += 1
    var _from = blockId;
    call_stack.pop();
    var _to = call_stack.length > 0 ? call_stack[call_stack.length - 1] : "END";
    if (total_step < SKIP_STEP){
        return _ret
    }
    _compare_trace("Return", blockId, _from, _to, _vars, _ret)
    return _ret;
}


function loadMsgQueue(filename) {
    /// load message que from the file
    const fs = require('fs');
    const path = require('path');
    // const filePath = path.join(__dirname, filename);
    const filePath = filename; // use relative path
    if (fs.existsSync(filePath)) {
        let data = fs
            .readFileSync(filePath)
            .toString();
        let messages = data.split("\n");
        for (let i = 0; i < messages.length; i++){
            let msg_sections = messages[i].split("|||");
            if (msg_sections.length < 4) {
                continue;
            }
            let new_msg = {}
            new_msg["evt"] = msg_sections[0];
            new_msg["from"] = msg_sections[1].split(":")[1]
            new_msg["to"] = msg_sections[2].split(":")[1]
            try{
                new_msg["vars"] = JSON.parse(msg_sections[3])
            }
            catch(e){
                if (msg_sections[3].includes("Infinity")){
                    new_msg["vars"] = JSON.parse(msg_sections[3].replace(/Infinity/g, '"Infinity"'))
                }
                else console.log(msg_sections[3])
            }
            
            try{
                new_msg["object_table"] = JSON.parse(msg_sections[4])
            }
            catch(e){
                if (msg_sections[4].includes("Infinity")){
                    new_msg["object_table"] = JSON.parse(msg_sections[4].replace(/Infinity/g, '"Infinity"'))
                }
                else console.log(msg_sections[4])
            }
            
            
            if (new_msg["evt"] !== "Call"){
                try{
                    new_msg["extra"] = JSON.parse(msg_sections[5])
                }
                catch(e){
                    if (msg_sections[5].includes("Infinity")){
                        new_msg["extra"] = JSON.parse(msg_sections[5].replace(/Infinity/g, '"Infinity"'))
                    }
                    else console.log(msg_sections[5])
                }
            }
            
            new_msg["random_shim"] = JSON.parse(msg_sections[6])
            new_msg["print_shim"] = JSON.parse(msg_sections[7])

            msg_queue.push(new_msg)
        }
    }
    else{
        throw new Error("File not found")
    }
    return;
}

function _compare_trace(evt, blockId, _from, _to, vars, extra){
    try{
        if (total_step % LOG_STEP === 0){
            let filename = TRACE_FOLDER + `/_step_trace_from_${total_step}_to_${total_step + LOG_STEP}.log`;
            msg_queue = [];
            console.log("[INFO] Checking Step:", [total_step, total_step + LOG_STEP])
            console.log("[INFO] Loading Trace Log File: ", filename)
            loadMsgQueue(filename)
        }

        if (DEBUG && total_step >= 10 * LOG_STEP){
            throw new Error("STOP EXEC")
        }
        
        var extra_str = ""; // circular structure
        try {
            extra_str = JSON.stringify(extra)
        }
        catch(e){
            extra_str = "complex value that cannot be JSON.stringified"
        }




        var msg = msg_queue[total_step % LOG_STEP];

        /// Check the shim functions
        if (msg['random_shim'].length === shim_random_seq.length){
            for (let i = 0; i < msg['random_shim'].length; i++){
                if (msg['random_shim'][i][0] !== shim_random_seq[i][0] || msg['random_shim'][i][1] !== shim_random_seq[i][1]){
                    let err_msg = {
                        "Step": total_step,
                        "Reason": "Random Shim Call Value Mismatch",
                        "Expected": msg['random_shim'][i],
                        "Got": shim_random_seq[i]
                    }
                    throw new Error(JSON.stringify(err_msg))
                }
            }
        }
        else{
            let err_msg = {
                "Step": total_step,
                "Reason": "Random Shim Call Number Mismatch",
                "Expected": msg['random_shim'].length,
                "Got": shim_random_seq.length
            }
            throw new Error(JSON.stringify(err_msg))
        }

        shim_random_seq = []
        
        if (msg['print_shim'].length === shim_print_seq.length){
            for (let i = 0; i < msg['print_shim'].length; i++){
                if (msg['print_shim'][i] !== shim_print_seq[i]){
                    let err_msg = {
                        "Step": total_step,
                        "Reason": "Print Shim Call Value Mismatch",
                        "Expected": msg['print_shim'][i],
                        "Got": shim_print_seq[i]
                    }
                    throw new Error(JSON.stringify(err_msg))
                }
            }
        }
        else{
            let err_msg = {
                "Step": total_step,
                "Reason": "Print Shim Call Number Mismatch",
                "Expected": msg['print_shim'].length,
                "Got": shim_print_seq.length
            }
            throw new Error(JSON.stringify(err_msg))
        }

        shim_print_seq = []

        if (evt !== msg['evt']){
            let err_msg = {
                "Step": total_step,
                "Reason": "Event Mismatch",
                "ExpectedEvt": msg['evt'],
                "ExpectedFrom": msg['from'],
                "ExpectedTo": msg['to'],
                "ExpectedExtra": msg['extra'],
                "ExpectedObjectTable": msg['object_table'],
                "GotEvt": evt,
                "GotFrom": _from,
                "GotTo": _to,
                "GotExtra": extra_str
            }
            throw new Error(JSON.stringify(err_msg))
        }

        if (msg['from'] !== _from.toString() || msg['to'] !== _to.toString()){
            let err_msg = {
                "Step": total_step,
                "Reason": "Jump Target Mismatch",
                "ExpectedEvt": msg['evt'],
                "ExpectedFrom": msg['from'],
                "ExpectedTo": msg['to'],
                "ExpectedExtra": msg['extra'],
                "ExpectedObjectTable": msg['object_table'],
                "GotEvt": evt,
                "GotFrom": _from,
                "GotTo": _to,
                "GotExtra": extra_str
            }
            throw new Error(JSON.stringify(err_msg))
        }

        /// First check return value, then check value of vairables.
        /// The order of building the oid table should be same as python side.
        if (evt === "Call"){
            // return
        }
        else if (evt === "Return"){
            var [eq, rs] = inTimeCompare(msg['extra'], msg['object_table'], extra, {});
            if (!eq){
                let err_msg = {
                    "Step": total_step,
                    "Reason": "Return Value Mismatch",
                    "ExpectedEvt": msg['evt'],
                    "ExpectedFrom": msg['from'],
                    "ExpectedTo": msg['to'],
                    "ExpectedExtra": msg['extra'],
                    "ExpectedObjectTable": msg['object_table'],
                    "GotEvt": evt,
                    "GotFrom": _from,
                    "GotTo": _to,
                    "GotExtra": extra_str,
                    "ReturnMismatchReason": rs
                }
                // console.log(JSON.stringify(msg, null, 4))
                throw new Error(JSON.stringify(err_msg))
            }
            // return
        }
        else if (evt ==="Throw"){
            // return
        }
        else{
            throw new Error("Evt not supported")
        }


        for (let varName in msg['vars']) {
            var [eq, rs] = inTimeCompare(msg['vars'][varName], msg['object_table'], vars[varName], {});
            if (!eq){
                var value_str = "";
                try {
                    value_str = JSON.stringify(vars[varName])
                }
                catch(e){
                    value_str = "complex value that cannot be JSON.stringified"
                }

                let err_msg = {
                    "Step": total_step,
                    "Reason": "Variable Mismatch",
                    "ExpectedEvt": msg['evt'],
                    "ExpectedFrom": msg['from'],
                    "ExpectedTo": msg['to'],
                    "ExpectedExtra": msg['extra'],
                    "ExpectedObjectTable": msg['object_table'],
                    "GotEvt": evt,
                    "GotFrom": _from,
                    "GotTo": _to,
                    "GotExtra": extra_str,
                    "VarName": varName,
                    "ExpectedValue": msg['vars'][varName],
                    "GotValue": value_str,
                    "VarMismatchReason": rs
                }
                throw new Error(JSON.stringify(err_msg))
            }
        }


        if (["Throw", "Return"].includes(evt) && blockId == 0){ /// End of the program
            let filename = TRACE_FOLDER + `/_step_check_result.json`;
            let msg = {
                "step": total_step,
            }
            const fs = require('fs');
            fs.writeFileSync(filename, JSON.stringify(msg, null, 4));
            // process.exit(0)
        }
    }
    catch(e){
        /// Early end the tracing
        /// Save in Json
        let filename = TRACE_FOLDER + `/_step_check_result.json`;
        let msg = {
            "step": total_step,
            "err": JSON.parse(e.message),
            "call_stack": call_stack,
        }
        const fs = require('fs');
        fs.writeFileSync(filename, JSON.stringify(msg, null, 4));
        process.exit(0)
    }
}

