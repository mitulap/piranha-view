/*
Router for 'timeSlots'.
It handles the requests for
(1) Creating a new timeSlot - /api/boats - POST
(2) Retrieving timeSlot based on date - /api/boats - GET
*/

var timeSlot = require('../models/timeSlotModel'); //to use timeSlotSchema
var errorResponse = require('./errorResponse');

var url = require('url');


module.exports = function(app){

	app.post('/api/timeslots', function(req, res){

		console.log("calling newTimeSlot create.");
		//API to create  a new timeSlots for Piranha View.
		/*	
			Parameters:
				timeslot[start_time]
					Start time of the timeslot, expressed as a Unix timestamp
					Example: 1406052000
				timeslot[duration]
					Length of the timeslots in minutes
					Example: 120
				Output:
					The created timeslot in JSON format, with the fields above, plus a unique ID, a customer count, an availability count, and a list of associated boat IDs
					On a new timeslot, the availability and customer count will necessarily be 0, and the boats will be an empty list
					Example: { id: abc123, start_time: 1406052000, duration: 120, availability: 0, customer_count: 0, boats: [] }
		*/

		//validating parameters

		if((req.body.timeslot.start_time == null) || (req.body.timeslot.duration == null)){
			//standard response code is 422 but right now I am using 400 as of now.
			return res.status(400).json(errorResponse("Make sure all required parameter/parameters are included in the request...!", 400));
		} else {

			var newTimeSlot = new timeSlot({
				start_time : new Date(req.body.timeslot.start_time * 1000),
				end_time : new Date((req.body.timeslot.start_time * 1000 ) + (60 * req.body.timeslot.duration * 1000) ),
				duration : req.body.timeslot.duration
			});

			//getting data to check if the same timeslot is present or not
			timeSlot.find({start_time: newTimeSlot.start_time, duration: newTimeSlot.duration}, function(err, doc){


				//Same timeSlot with start_time and duration is not present
				if(doc.length == 0){
					newTimeSlot.save(function(err){
						//If any error comes
			            if(err) return res.status(500).json(errorResponse(err.errmsg, 500));
						console.log("Timeslot "+ newTimeSlot.start_time +" saved successfully");

			            //return res.status(200).json({id:newTimeSlot.id, start_time: newTimeSlot.start_time, duration: newTimeSlot.duration, availability: newTimeSlot.availability, customer_count: newTimeSlot.customer_count, boats:[]});
			            return res.status(200).json({id:newTimeSlot.id, start_time: req.body.timeslot.start_time, duration: newTimeSlot.duration, availability: newTimeSlot.availability, customer_count: newTimeSlot.customer_count, boats:[]});
			        });
				}else{
					return res.status(200).json({error:"TimeSlot already exists. Please try different timeSlot"});
				}

			});
		}

	});


	app.get('/api/timeslots', function(req, res){
			//API to find all available timeSlots

			/*			
				Parameters:
					date
					Date in YYYY-MM-DD format for which to return timeslots
					Example: 2014-07-22
				Output:
					An array of timeslots in JSON format, in the same format as above
					Example: [{ id: abc123, start_time: 1406052000, duration: 120, availability: 4, customer_count: 4, boats: ['def456',...] }, ...]
					The customer count is the total number of customers booked for this timeslot.
					The availability is the maximum booking size of any new booking on this timeslot. 
			*/


			//getting parameter from the url
			var urlParts = url.parse(req.url, true);
			var query = urlParts.query;

			//validating input
			if(urlParts.query.date == null){
				//standard response code is 422 but right now I am using 400 as of now.
				return res.status(400).json(errorResponse("Make sure all required parameter/parameters are included in the request...!", 400));
			} else {

				//splitting input date parameter in to YYYY, MM and DD to use them to create a new Date object.
				var parts = urlParts.query.date.split('-');		

				//newDate Object - given Date
				var normalDate = new Date(parts[0], parts[1]-1, parts[2]);
				
				//nextDate object - next day of the given date (normalDate)
				var nextDate = new Date(parts[0], parts[1]-1, parts[2]);
				nextDate.setDate(nextDate.getDate() + 1); //setting date to next day of normalDate

				//finding in DB
				timeSlot.find({ start_time: {"$gte": normalDate, "$lt": nextDate} }, function(err, timeSlots){

					if(!err){
						
						//building JSON response to sent.
						var timeSlotsArr = [];



						for (var i = 0; i < timeSlots.length; i++) {

							//converting date in to unixtimestamp
							var unixTimeStampDate = Date.parse(timeSlots[i].start_time)/1000;
							
							//creating boats araay of id to sent
							var boatsArrId = [];

							for( var k = 0; k < timeSlots[i].boatsDetails.length; k++){
								boatsArrId.push(timeSlots[i].boatsDetails[k].id);
							}


							//Constructing a JSON object to enter in the timeSlotsArr				
						    var timeSlotStr = {	
						    	id : timeSlots[i].id,
						    	start_time : unixTimeStampDate,
						    	duration : timeSlots[i].duration,
						    	availability : timeSlots[i].availability,
						    	customer_count : timeSlots[i].customer_count,
						    	boats : boatsArrId
						    };
						    timeSlotsArr.push(timeSlotStr);
						}
						//returning result in case of success
						return res.status(200).json(timeSlotsArr);
					} else {
						//returning error in case of error
						return res.status(500).json(errorResponse(err.errmsg, 500));
					}
					
				});

			}
			
	});
}