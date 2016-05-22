var mongoose = require('mongoose');
var uuid = require('node-uuid');
var Schema = mongoose.Schema;

var schema = new Schema({
	user_id : { type : String, default : function(){ return uuid(); } },
	username : { type: String, required : true, unique : true},
	password : { type : String, required : true},
	email : {type : String, required : true },
	phone : { type : String},
	address : {type : String }

}, { strict : false});


var userModel = mongoose.model('Users', schema);

module.exports = userModel;