var mongoose = require('mongoose');
var uuid = require('node-uuid');
var Schema = mongoose.Schema;

var schema = new Schema({
	boat_id : { type : String, unique: true} }
}, { strict : false});


var boatBookingModel = mongoose.model('boatBookings', schema);

module.exports = boatBookingModel;