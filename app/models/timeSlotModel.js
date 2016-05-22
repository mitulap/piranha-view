var mongoose = require('mongoose');
var uuid = require('node-uuid');
var Schema = mongoose.Schema;

var schema = new Schema({
	id : { type : String, default : function(){ return uuid(); } },
	start_time : { type : Date, required : true},
	end_time : {type: Date, required: true},
	duration : { type : Number, required : true},
	availability : {type : Number, default: 0 },
	customer_count : { type : Number, default: 0},
	boatsDetails: [{
		id : {type:String},
		capacity : {type: Number},
		usedSeats : {type: Number, default:0},
		isBeingUsed : {type: Boolean, default:false}
	}]

}, { strict : false});


var timeSlotModel = mongoose.model('timeSlots', schema);

module.exports = timeSlotModel;

//{ id: abc123, start_time: 1406052000, duration: 120, availability: 0, customer_count: 0, boats: [] }

/*usedBoats : [{
		boat_id : {type:String},
		seats : {type: Number}
	}]*/

	//	boats : { type: [String],ref: 'timeSlot'},