var mongoose = require('mongoose');
var uuid = require('node-uuid');
var Schema = mongoose.Schema;

var schema = new Schema({
	id : { type : String, default : function(){ return uuid(); } },
	name : { type: String, required : true, unique : true},
	capacity : { type : Number, required : true},
	beingUsedBy : [{
		timeSlotId : {type:String},
		start_time : {type: Date},
		end_time : {type: Date}
	}]
}, { strict : false});


var boatModel = mongoose.model('boats', schema);

module.exports = boatModel;