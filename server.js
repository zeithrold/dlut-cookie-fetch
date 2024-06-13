const http = require('node:http')

http.createServer((req, res) => {
  console.log(req)
  res.end('Hello World')
}).listen(3000)
