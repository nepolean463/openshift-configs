const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('D0280 Node.js App - Automated Build Demo\n');
});
server.listen(8080, () => {
  console.log('D0280 app running on port 8080');
});
