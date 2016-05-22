var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var mongoose = require('mongoose');


mongoose.connect('mongodb://localhost/piranhaDB');

mongoose.connection.on('open', function (ref) {
  console.log('Connected to mongo server.');
});
mongoose.connection.on('error', function (err) {
  console.log('Could not connect to mongo server!');
  return res.status(503).json(errorResponse("Error connecting database", 503));
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); 
app.use (function (error, req, res, next){
    
    res.status(200).json({errMsg:"Invalid JSON Data"});
});
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, token");
  next();
});

//app.all(expressJWT({ secret: 'Ebay Shopping cart'}). unless({ path: ['/users/login']}));

//require('./app/routes/product')(app);
//require('./app/routes/user')(app);


require('./app/routes/boatApis')(app);
require('./app/routes/timeSlotApis')(app);
require('./app/routes/mainApis')(app);

/*app.get('*', function(req, res, next) {
  var err = new Error();
  err.status = 404;
  next(err);
});*/

app.post('*', function(req, res, next) {
  var err = new Error();
  err.status = 404;
  next(err);
});

module.exports = app;