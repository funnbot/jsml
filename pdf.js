var fs = require('fs');
var pdf = require('html-pdf');
var html = fs.readFileSync('./build/index.html', 'utf8');
var options = { localUrlAccess: true, base: "file://" + __dirname + "/build/" };
pdf.create(html, options).toFile('./build/index.pdf', function(err, res) {
  if (err) return console.log(err);
  console.log(res);
});