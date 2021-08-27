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

    join() { return this.#elements.join("\n"); }
}

// a real number represented by a/b, it is rational if a and b are integers, irrational is difficult and we wont go there
// if b is one it is a integer
class Real {

}

// Make a matrix class that will format into a KaTeX matrix
// Row major, which means vals[column][row]
class Matrix {
    #vals = [];
}

// //{step}, //{require}, //{title}, //{sub}, //{p}

// Includes the actual js file, and gets all of the exported functions
// A way to include multiple library files in the header, and have them appear in the document
// Add a way to include steps inside the function, that are notated with mljs comments (//>) that will output a certain step
// Include a library that has a step function, that excepts certain formats
// stepImply(output) //{step} 
class Code {

}

const code = str => Elem.pre(hl.highlight(str, { language: "javascript" }).value)
    .prop("class", "highlight").prop("lang", "javascript")
    .toString();

const math = str => katex.renderToString(str, { throwOnError: false, output: "html" });

const template = fs.readFileSync(path.resolve(__dirname, path.join("html", "template.html")));

const outputFile = "html/index.html";

const templateInsert = "<TEMPLATE_INSERT>";
const insert = template.findIndex((v, i, a) => v === templateInsert.charCodeAt(0) && a.subarray(i + 1, i + templateInsert.length).toString() === templateInsert.slice(1));

let doc = new Doc();
doc.push(Elem.h1("Title"));
doc.push(Elem.h1("Below the valley"));
doc.push(Elem.p("paragraph of stuff would go here"));
doc.push(code("const js = 10\njs += 2;\n"));
doc.push(math(`\\begin{bmatrix}a & b \\\\c & d\\end{bmatrix}`));
doc.push(math(`= \\begin{bmatrix}a & b \\\\c & d\\end{bmatrix}`));
doc.push(Elem.h2("Credits"));

const output = template.subarray(0, insert) + doc.toString() + template.subarray(insert + templateInsert.length, template.length);
fs.writeFileSync(outputFile, output);