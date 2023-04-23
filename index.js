const katex = require("katex");
const fs = require("fs");
var pdf = require('html-pdf');
const rewire = require("rewire");
const path = require("path");
const hl = require("highlight.js/lib/core");
const jsml = require("./lib/jsml.js");
const { execSync } = require("child_process");
hl.registerLanguage("javascript", require("highlight.js/lib/languages/javascript"));

const highlight = str => hl.highlight(str, { language: "javascript" }).value
const math = str => katex.renderToString(str, { throwOnError: false, output: "html" });

class Elem {
    #tag = ""; #props = { }; #inner = "";

    constructor(tag) { this.#tag = tag; }

    prop(key, val) { this.#props[key] = val; return this; }
    inner(str) { this.#inner = str; return this; }
    toString() { return `<${this.#tag} ${this.#formatProps()}>${this.#inner}</${this.#tag}>`; }

    #formatProps() { return Object.keys(this.#props).map(k => `${k}="${this.#props[k]}"`).join(" "); }

    static h1(str) { return new Elem("h2").inner(str); }
    static h2(str) { return new Elem("h3").inner(str); }
    static p(str) { return new Elem("p").inner(str); }
    static pre(str) { return new Elem("pre").inner(str); }
}

class Doc {
    #elements = [];

    push(str) { this.#elements.push(str); return this; }

    toString() { return this.#elements.join("\n") }
}

// a real number represented by a/b, irrational is difficult and we wont go there
// if b is one it is a integer then its a whole number
class Real {
    #a = 0; #b = 1;

    constructor(a, b = 1) { this.#a = a; }
    toString() { return (this.#a / this.#b).toString(); }
    valueOf() { return this.#a / this.#b; }
}

// Make a matrix class that will format into a KaTeX matrix
// Row major, which means vals[column][row]
class Matrix {
    #vals = [];

    constructor(vals) { this.#vals = vals }
    toString() {
        const katex = `\\begin{bmatrix}${this.#vals.map(a => a.join("&")).join("\\\\")}\\end{bmatrix}`
        return katex;
    }
}
// //{step}, //{require}, //{title}, //{sub}, //{p}

// Includes the actual js file, and gets all of the exported functions
// A way to include multiple library files in the header, and have them appear in the document
// Add a way to include steps inside the function, that are notated with mljs comments (//>) that will output a certain step
// Include a library that has a step function, that excepts certain formats
// stepImply(output) //{step} 
function parse(filepath) {
    const file = fs.readFileSync(filepath, "utf-8").toString();
    let runcodeIndex = 0, runcodeValue = [];
    let tempFile = file.replace(/\/\/r (.+)/g, (_, match) => "\/* \/\/r *\/ module.exports.__JSML__" + (runcodeIndex++) + " () { " + match + " }\n");
    tempFile = tempFile.replace("//")
    tempFile = "const { stepInput, stepEqual, stepImply } = require(\"\")\n";

    const tempPath = "out/" + path.parse(filepath).name + ".js";
    fs.writeFileSync(tempPath, tempFile);
    const fileCode = require(path.resolve(process.cwd(), filepath));
    // fs.rmSync(tempPath);

    let text = [];

    let runcodeIndex = 0;
    let i = 0;
    while (i < file.length) {
        let char = file[i];
        const peek = (amt = 1) => (i + amt) < file.length ? file[i + amt] : null;
        const eof = () => peek() === null;
        const readTill = (end = "\n") => {
            let buf = char = file[i];
            while (!eof() && char !== end) buf += (char = file[++i]);
            return buf.trim();
        }

        if (char === "/" && peek() === "/") {
            i++; // skip the slash
            const op = peek();
            i += 2; // skip the op
            if (op === "/") text.push({ style: "paragraph", str: readTill() });
            else if (op === "t") text.push({ style: "title", str: readTill() });
            else if (op === "s") text.push({ style: "subtitle", str: readTill() });
            else if (op === "i") text.push({ style: "include", data: parse(readTill()) })
            else if (op === "r") text.push({ style: "run", funcName: })
            else if (op === "c") {
                const funcName = readTill();
                i++; // skip newline
                let buf = "";
                const start = i;
                let end = start;
                while (i < file.length) {
                    if (file[i] === "/" && peek() === "/") {
                        i++;
                        if (peek() === "e") {
                            end = i - 2;
                            readTill() // drop the endcode
                            break;
                        }
                    }
                    i++;
                }
                text.push({ style: "code", str: file.slice(start, end + 1) })
                // code[funcName] = {
                //     str: file.slice(start, end + 1),
                //     func: fileCode.__get__(funcName),
                // };
            }
        }
        i++;
    }
    return { text, fileCode, runcodeValue };
}

function display({ text, fileCode, runcodeValue }) {
    let doc = new Doc();
    for (let i = 0; i < text.length; i++) {
        const t = text[i];
        if (t.style === "title") doc.push(Elem.h1(t.str));
        else if (t.style === "subtitle") doc.push(Elem.h2(t.str));
        else if (t.style === "paragraph") {
            let fmt = "";
            let ii = 0;
            while (ii < t.str.length) {
                const peek = (amt = 1) => (ii + amt) < t.str.length ? t.str[ii + amt] : null;
                const readTill = (end) => {
                    let buf = t.str[ii];
                    while (peek() !== null && peek() !== end) buf += t.str[++ii];
                    return buf;
                }
                if (t.str[ii] === "m" && peek() === "`") {
                    ii += 2;
                    fmt += math(readTill("`"));
                    ii += 2;
                } else if (t.str[ii] === "c" && peek() === "`") {
                    ii += 2;
                    fmt += `<code>${highlight(readTill("`"))}</code>`;
                    ii += 2;
                } else fmt += t.str[ii++];
            }
            doc.push(Elem.p(fmt));
        }
        else if (t.style === "code") doc.push(new Elem("pre").inner(highlight(t.str)));
        else if (t.style === "include") {
            doc.push(display(t.data).toString())
        }
        else if (t.style === "run") {
            const callRegex = /^([^\(]+)\((.*)\);?$/;
            const callParsed = callRegex.exec(t.code);
            const [_, funcName, argsText] = callParsed;
            try {
                var args = eval("[" + argsText + "]");
                code[funcName].func(...args);
            } catch (e) {
                doc.push(new Elem("code").inner(highlight(t.code)));
                doc.push(new Elem("code").prop("style", "color: red;").inner(e.message));
                continue;
            }
            let elem;
            while ((elem = jsml._steps[funcName].shift()) !== undefined) {
                let delim = "";
                if (elem.type === "equal") delim = "=";
                else if (elem.type === "imply") delim = "=>";
                
                doc.push(math(delim + elem.obj.toString()));
                doc.push(new Elem("p").prop("class", "overlay").inner(elem.note));
            }
        }
    }
    return doc;
}

const template = fs.readFileSync(path.resolve(__dirname, path.join("resources", "template.html")));
const templateInsert = "<TEMPLATE_INSERT>";
const insert = template.findIndex((v, i, a) => v === templateInsert.charCodeAt(0) && a.subarray(i + 1, i + templateInsert.length).toString() === templateInsert.slice(1));

const argv = process.argv.slice(2);
if (argv.indexOf("--html") > -1) var doHtmlOnly = true;

const inputFile = argv[argv.length - 1];
let inputParsed = path.parse(inputFile);
const parsedFile = parse(inputFile);
const renderedFile = display(parsedFile);
const output = template.subarray(0, insert).toString() + renderedFile.toString() + template.subarray(insert + templateInsert.length, template.length).toString();
if (!doHtmlOnly) {
    var options = { format: "Letter", localUrlAccess: true, base: "file://" + path.join(__dirname, "distrib/") };
    pdf.create(output, options).toFile(path.join("out", inputParsed.name + ".pdf"), function (err, res) {
        if (err) return console.log(err);
        console.log("Finished.");
    });
} else {
    fs.writeFileSync(path.join("out", inputParsed.name + ".html"), output);
}