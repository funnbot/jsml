const katex = require("katex");
const fs = require("fs");
const path = require("path");
const hl = require("highlight.js/lib/core");
hl.registerLanguage("javascript", require("highlight.js/lib/languages/javascript"));

class Elem {
    #tag = ""; #props = {}; #inner = "";

    constructor(tag) { this.#tag = tag; }

    prop(key, val) { this.#props[key] = val; return this; }
    inner(str) { this.#inner = str; return this; }
    toString() { return `<${this.#tag} ${this.#formatProps()}>${this.#inner}</${this.#tag}>`; }

    #formatProps() { return Object.keys(this.#props).map(k => `${k}="${this.#props[k]}"`).join(" "); }

    static h1(str) { return new Elem("h1").inner(str); }
    static h2(str) { return new Elem("h2").inner(str); }
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
    isInteger() {  return this.#b === 1 && Number.isInteger(this.#a); }
    toString() { return (this.#a / this.#b).toString(); }
}

// Make a matrix class that will format into a KaTeX matrix
// Row major, which means vals[column][row]
class Matrix {
    #vals = [];

    constructor(vals) { this.#vals = vals }
    toString() {
        const katex = `\\begin{bmatrix}${this.#vals.map(a => a.join("&")).join("\\\\")}\\end{bmatrix}`
        return math(katex); // katex to html;
    }
}
// //{step}, //{require}, //{title}, //{sub}, //{p}

// Includes the actual js file, and gets all of the exported functions
// A way to include multiple library files in the header, and have them appear in the document
// Add a way to include steps inside the function, that are notated with mljs comments (//>) that will output a certain step
// Include a library that has a step function, that excepts certain formats
// stepImply(output) //{step} 
/**
 * 
 * @param {Buffer} file 
 */
function parse(filepath) {
    const file = fs.readFileSync(filepath, "utf-8").toString();
    const fileCode = require(path.resolve(process.cwd(), filepath));

    let text = [];
    let code = {};
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
            else if (op === "t") text.push({style: "title", str: readTill() });
            else if (op === "s") text.push({style: "subtitle", str: readTill() });
            else if (op === "i") text.push({style: "include", data: parse(readTill())})
            else if (op === "r") text.push({style: "run", code: readTill() })
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
                text.push({style: "code", funcName})
                code[funcName] = {
                    str: file.slice(start, end + 1),
                    func: fileCode[funcName],
                };
            }
        }
        i++;
    }
    return {text, code};
}

const highlight = str => hl.highlight(str, { language: "javascript" }).value

function display({text, code}) {
    let doc = new Doc();
    for (let i = 0; i < text.length; i++) {
        const t = text[i];
        if (t.style === "title") doc.push(Elem.h1(t.str));
        else if (t.style === "subtitle") doc.push(Elem.h2(t.str));
        else if (t.style === "paragraph") doc.push(Elem.p(t.str));
        else if (t.style === "code") doc.push(new Elem("pre").inner(highlight(code[t.funcName].str)));
        else if (t.style === "include") doc.push(display(t.data))
        else if (t.style === "run") doc.push(new Elem("code").inner(highlight(t.code)))
    }
    return doc;
}

const math = str => katex.renderToString(str, { throwOnError: false, output: "html" });

const template = fs.readFileSync(path.resolve(__dirname, path.join("resources", "template.html")));

const outputFile = "build/index.html";

const templateInsert = "<TEMPLATE_INSERT>";
const insert = template.findIndex((v, i, a) => v === templateInsert.charCodeAt(0) && a.subarray(i + 1, i + templateInsert.length).toString() === templateInsert.slice(1));

console.log(parse("input.js"));
const p = parse("input.js");
const d = display(p);


let doc = new Doc();
// doc.push(Elem.h1("Title"));
// doc.push(Elem.h1("Below the valley"));
// doc.push(Elem.p("paragraph awd inline code of stuff would go here"));
// doc.push(code("const js = 10\njs += 2;\n"));
// doc.push(math(`\\begin{bmatrix}a & b \\\\c & d\\end{bmatrix}`));
// doc.push(new Matrix([[1, 2, 3], ["a", "c", "b"], ["x", 0.022, 1.2]]));
// doc.push(Elem.h2("Credits"));

const output = template.subarray(0, insert).toString() + d.toString() + template.subarray(insert + templateInsert.length, template.length).toString();
fs.writeFileSync(outputFile, output);