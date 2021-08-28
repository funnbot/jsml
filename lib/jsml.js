_steps = {

};

function stepInput(obj, note = "") {
    step(stepInput.caller.name, obj, note, "begin");
}

function stepEqual(obj, note = "") {
    step(stepEqual.caller.name, obj, note, "equal");
}

function stepImply(obj, note = "") {
    step(stepImply.caller.name, obj, note, "imply");
}

function step(caller, obj, note, type) {
    if (_steps[caller] === undefined) _steps[caller] = [];
    _steps[caller].push({obj, note, type});
}

module.exports = { _steps, stepInput, stepEqual, stepImply };