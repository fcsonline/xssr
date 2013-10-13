var express = require('express');

var app = express();

app.configure(function () {
  app.use(express.bodyParser());
  app.use(app.router);
  app.use(express.logger());
  app.use(express.static(__dirname));
});

app.listen(8001);

app.post('/level3', function (req, res) {
  console.log('Testing level3');
  res.contentType('json');
  res.send(req.body);
});
