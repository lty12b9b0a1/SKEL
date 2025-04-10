// const TRACE_FOLDER = ...
const DEBUG = false
const MAX_LEVEL = 2 // only used in fast mode
const LOG_STEP = 10000 // total steps per log file
const SKIP_STEP = 0 // skip the first n steps

let total_step = -1
let call_stack = []
let msg_queue = []



function inTimeCompare(x, y, level) {
    let tpx_a = typeof x;
    // console.log(x, tpx_a)

    /// The below part allow some relax in the comparison.
    /// An self-adaptive comparison strategy is future work.
    if (level === 0){
        return true
    }
    if (tpx_a === "string"){
        if (Number(x) === y || y !== undefined && y !== null && y.toString() === x || x === y) return true;
        return false;
    }
    else if (tpx_a === "number" || tpx_a === "boolean" || x === null) {
        return x === y;
    }
    else if (x[0] == "U"){
        if (y === "unknown value" || y === null){
            return false
        }
        return true;
    }
    else if (y === null || y === undefined){
        return false;
    }
    else if (x[0] === "F") {
        if (x[1] === "<lambda>") {
            return [true, null];
        }
        return x[1] === y.name;
    }
    else if (x[0] === "L") {
        if (y.constructor === Array && x[1] === y.length) {
            for (let i = 0; i < x[1]; i++) {
                if (!inTimeCompare(x[2][i], y[i], level - 1)) {
                    return false;
                }
            }
            return true;
        }
        else{
            return false
        }
    }
    else if (x[0] === "SET") {
        if (y.constructor === Set && x[1].length === y.size) {
            for (let v of x[1]) {
                if (!y.has(v)) {
                    return false;
                }
            }
            return true;
        }
        else{
            return false
        }
    }
    else if (x[0] === "BYTES") {
        if (y.constructor === Buffer || y.constructor === Uint8Array || y.constructor === ArrayBuffer) {
            if (typeof x[1] !== "number"){
                for (let i = 0; i < x[1].length; i++) {
                    if (x[1][i] !== y[i]) {
                        return false;
                    }
                }
                return true;
            }
            else{
                if (x[1] !== y.length) {return false}
                for (let i = 0; i < x[2].length; i++) {
                    if (x[2][i] !== y[i]) {
                        return false;
                    }
                }
                return true;
            }
        }
        else{
            return false
        }
    }
    // else if (x[0] === "MAP") {
    //     if (consx === Map) {
    //         if (x.size !== y.size) {
    //             return false;
    //         }
    //         for (let [k, v] of x) {
    //             if (!y.has(k) || !inTimeCompare(v, y.get(k), level - 1)) {
    //                 return false;
    //             }
    //         }
    //         return true;
    //     }
    //     else{
    //         return false
    //     }
    // }
    else if (x[0] === "D") {
        if (y.constructor === Object) {
            for (let k of x[1]) {
                if (!inTimeCompare(k[1], y[k[0]], level - 1)) {
                    return false;
                }
            }
            return true;
        }
        else{
            return false;
        }
    }
    else return true;
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
            try{
                let msg_sections = messages[i].split("|||");
                if (msg_sections.length < 4) {
                    continue;
                }
                let new_msg = {}
                new_msg["evt"] = msg_sections[0];
                new_msg["from"] = msg_sections[1].split(":")[1]
                new_msg["to"] = msg_sections[2].split(":")[1]
                new_msg["vars"] = JSON.parse(msg_sections[3])
                if (new_msg["evt"] !== "Call"){
                    new_msg["extra"] = JSON.parse(msg_sections[4])
                }
                msg_queue.push(new_msg)
            }
            catch(e){
                console.log(messages[i])
            }
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

        var msg = msg_queue[total_step % LOG_STEP];
        if (evt !== msg['evt']){

            var extra_str = "";
            try {
                extra_str = JSON.stringify(extra)
            }
            catch(e){
                extra_str = "complex value that cannot be JSON.stringified"
            }
            let err_msg = {
                "Step": total_step,
                "Reason": "Event Mismatch",
                "ExpectedEvt": msg['evt'],
                "ExpectedFrom": msg['from'],
                "ExpectedTo": msg['to'],
                "ExpectedExtra": msg['extra'],
                "GotEvt": evt,
                "GotFrom": _from,
                "GotTo": _to,
                "GotExtra": extra_str
            }
            throw new Error(JSON.stringify(err_msg))
        }
        
        if (msg['from'] !== _from.toString() || msg['to'] !== _to.toString()){
            var extra_str = "";
            try {
                extra_str = JSON.stringify(extra)
            }
            catch(e){
                extra_str = "complex value that cannot be JSON.stringified"
            }
            let err_msg = {
                "Step": total_step,
                "Reason": "Jump Target Mismatch",
                "ExpectedEvt": msg['evt'],
                "ExpectedFrom": msg['from'],
                "ExpectedTo": msg['to'],
                "ExpectedExtra": msg['extra'],
                "GotEvt": evt,
                "GotFrom": _from,
                "GotTo": _to,
                "GotExtra": extra_str
            }
            throw new Error(JSON.stringify(err_msg))
        }


        if (evt === "Call"){
            // return
        }
        else if (evt === "Return"){
            var eq = inTimeCompare(msg['extra'], extra, MAX_LEVEL);
            if (!eq){
                var extra_str = "";
                try {
                    extra_str = JSON.stringify(extra)
                }
                catch(e){
                    extra_str = "complex value that cannot be JSON.stringified"
                }
                let err_msg = {
                    "Step": total_step,
                    "Reason": "Return Value Mismatch",
                    "ExpectedEvt": msg['evt'],
                    "ExpectedFrom": msg['from'],
                    "ExpectedTo": msg['to'],
                    "ExpectedExtra": msg['extra'],
                    "ExpectedObjectTable": {},
                    "GotEvt": evt,
                    "GotFrom": _from,
                    "GotTo": _to,
                    "GotExtra": extra_str,
                }
                // console.log(JSON.stringify(msg, null, 4))
                throw new Error(JSON.stringify(err_msg))
            }
            // return
        }
        else if (evt ==="Throw"){ /// As long as the exception is thrown, it's viewed as correct. Since the error string can be different.
            // return
        }
        else{
            throw new Error("Evt not supported")
        }


        for (let varName in msg['vars']) {
            var eq = inTimeCompare(msg['vars'][varName], vars[varName], MAX_LEVEL);
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
                    "ExpectedObjectTable": {},
                    "GotEvt": evt,
                    "GotFrom": _from,
                    "GotTo": _to,
                    "GotExtra": extra,
                    "VarName": varName,
                    "ExpectedValue": msg['vars'][varName],
                    "GotValue": value_str,
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

