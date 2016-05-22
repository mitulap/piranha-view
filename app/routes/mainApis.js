/*
Router for bookings and assgnment APIs.
It handles the requests for
(1) Assign a boat in a timeslot - /api/assignments - POST
(2) Book a boat for numberOfCustomer - /api/bookings - POST
*/

var timeSlot = require('../models/timeSlotModel'); //to use timeSlotSchema
var boat = require('../models/boatModel'); //to use boats schema
var errorResponse = require('./errorResponse');
var async = require('async');
var url = require('url');

var flagVar = false;
var globalVersion;
module.exports = function(app){

	app.post('/api/assignments', function(req, res){

		//API to assign boat to a timeSlot
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
		
		timeSlot.findOne({ id: req.body.assignment.timeslot_id }, function (err, doc){	  	

		  	if(err) return res.status(500).json(errorResponse(err.errmsg, 500));

		  	if(doc == null){
		  		return res.status(500).json(errorResponse("No Document found for the given timeSlot Id.", 500));
		  	}

		  	//checks whether the boat is present or not
		  	for( var i = 0; i < doc.boatsDetails.length; i++){
		  		if(doc.boatsDetails[i].id === req.body.assignment.boat_id){
		  			return res.status(200).json({msg:"Boat is already present in the timeslot"});
		  		}
		  	}
			    
			    //Now checking whether the boat is being used or not
			    //Getting boat data
		    boat.findOne({id : req.body.assignment.boat_id}, function(err, boatDoc){

		    		var lengthOftheResult = isBoatBeingUsedForTheSameTimeInterval(doc.start_time, doc.duration, boatDoc);

		    		//creating a doc for adding a new boat in timeSlot
				    var boatDetailsData = {
				    	id : req.body.assignment.boat_id,
				    	capacity : boatDoc.capacity,
				    	isBeingUsed : false,
				    	usedSeats : 0
				    }


		    		if(lengthOftheResult > 0){
		    			//do nothing
		    		}else{
		    			if(doc.availability < boatDoc.capacity ) {
			    			doc.availability = boatDoc.capacity;
			    		}
		    		}
		    		
		    	doc.boatsDetails.push(boatDetailsData);
		    	doc.save();
		    	return res.status(200).json({});
		    });
		});
	});


	app.post('/api/bookings', function(req, res){
			//API to book for a boat

			/*			
				Parameters:
					booking[timeslot_id]
					A valid timeslot id
					Example: abc123
				booking[size]
					The size of the booking party
					Example: 4
				Output:
					none
			*/

			timeSlot.findOne({ id: req.body.booking.timeslot_id }, function (err, doc){
				//If booking size is greater than available count for the timeSlot then return error

				if(doc.boatsDetails.length == 0){
					return res.status(200).json({error:"No Boats Assigned to the timeSlot"});
				}

				if(doc.availability < parseInt(req.body.booking.size)) {
					return res.status(200).json({error:"Booking size exceeds the available count"});
				} else {

					//check whether boats are assigned or not
					if(doc.boatsDetails.length == 0){
						return res.status(200).json({error:"No Boats Assigned to the timeSlot"});
					}else{
						
						var remainingCapacities = []	;//to update availability later
						var boatAssigned = false;// Boolean flag to check if the boat is assigned to 
												 // this timeSlot in this request. If it is assigned then we do not to reassign.
												 // Pass the control and use other boat's capacity based on whether they are used in this 
												 // and/or other boats. And updates the availability for this timeSlot later after getting 
												 // all the availability from each boats

						//Adding boatId to check in the DB for getting boatData
						var boatIds =[];
						for( var i = 0; i< doc.boatsDetails.length; i++){
							boatIds.push(doc.boatsDetails[i].id);
						}

						var usedBoatId;//boat which is recently being updated for this timeSlot

						boat.find({id: {$in: boatIds}}, function(err, singleBoat){
							// getting data for all boats which are being used by this timeSlot

							for(var i = 0; i < singleBoat.length; i++){

								var usedBoatCapacity = getUsedCapacityForThisBoat(doc.boatsDetails, singleBoat[i].id);
								console.log("---------------------");
								console.log(usedBoatCapacity);


								if(singleBoat[i].beingUsedBy.length == 0){
								//boat is not being used in any of the timeSlot
								// In this case we can skip the step of checking overlapping timeslot as no other time slot is using this boat

									if(singleBoat[i].capacity >= parseInt(req.body.booking.size)) {
										//This boat can handle new booking of the given size - passes the condition

										if(boatAssigned != true){


											var date = new Date(doc.start_time);
											var endDate = new Date(date.getTime() + (doc.duration * 60000));
											// var newDateObj = new Date(oldDateObj.getTime() + diff*60000);

											var beingUsedByObj = {
												timeSlotId : doc.id,
												start_time : date,
												end_time : endDate
											};

											//singleBoat[i].beingUsedBy.push(beingUsedByObj);
											
											//now updating data for timeSlot
											var usedBoatObj = {
												boat_id: singleBoat[i].id,
												seats : parseInt(req.body.booking.size)
											}


											// getting index for the boat is timeslot to update boatsDetails for that boat
											var index;
											for(var z = 0; z < doc.boatsDetails.length; z++) {
											   if(doc.boatsDetails[z].id === singleBoat[i].id) {
											   		index = z;
											     	break;
											   }
											}

											doc.boatsDetails[index].isBeingUsed = true;
											doc.boatsDetails[index].usedSeats = doc.boatsDetails[index].usedSeats + parseInt(req.body.booking.size);

											singleBoat[i].beingUsedBy.push(beingUsedByObj);

											//setting id for used boat in order to update references for the time slot
											usedBoatId = singleBoat[i].id;

											remainingCapacities.push((singleBoat[i].capacity - parseInt(req.body.booking.size)));
											singleBoat[i].markModified(singleBoat[i].beingUsedBy);
											
											doc.markModified(doc.boatsDetails);

											boatAssigned = true;
										} else {
											remainingCapacities.push((singleBoat[i].capacity - (usedBoatCapacity)));
										}
									} else {
										remainingCapacities.push(singleBoat[i].capacity - usedBoatCapacity);
									}

								} else {

										var lengthOfOverLappingTimeSlots = isBoatBeingUsedForTheSameTimeInterval(doc.start_time, doc.duration, singleBoat[i]);

										if(lengthOfOverLappingTimeSlots == 0){
											//if it is not being used in the certain time interval. Then it is free to be used by any time interval
											
											boatCapacity = singleBoat[i].capacity;

											if((boatCapacity- usedBoatCapacity) >= parseInt(req.body.booking.size)) {

												//This boat can handle new booking of the given size
												if(boatAssigned != true){

													var date = new Date(doc.start_time);
													var endDate = new Date(date.getTime() + (doc.duration * 60000));
													// var newDateObj = new Date(oldDateObj.getTime() + diff*60000);

													var beingUsedByObj = {
														timeSlotId : doc.id,
														start_time : date,
														end_time : endDate
													};

													
													
													//now updating data for timeSlot
													var usedBoatObj = {
														boat_id: singleBoat[i].id,
														seats : parseInt(req.body.booking.size)
													}
													var index;

													for(var z = 0; z < doc.boatsDetails.length; z++) {
													   if(doc.boatsDetails[z].id === singleBoat[i].id) {
													   		index = z;
													     	break;
													   }
													}

													usedBoatExists = doc.boatsDetails.filter(function(data){
														return ((data.id === singleBoat[i].id) && (data.isBeingUsed == true));
													});
													
													if(usedBoatExists.length > 0){

														if(doc.boatsDetails[index].usedSeats == singleBoat[i].capacity){
															doc.boatsDetails[index].usedSeats = singleBoat[i].capacity;
														} else {
															doc.boatsDetails[index].usedSeats = doc.boatsDetails[index].usedSeats + parseInt(req.body.booking.size);
														}

														//doc.boatsDetails[index].usedSeats = doc.boatsDetails[index].usedSeats + parseInt(req.body.booking.size);
													}else{
														
														doc.boatsDetails[index].isBeingUsed = true;
														doc.boatsDetails[index].usedSeats =  doc.boatsDetails[index].usedSeats + parseInt(req.body.booking.size);	
													}

													//checking if the beignUsed by contains the id of current time slot
													timeSlotExists = singleBoat[i].beingUsedBy.filter(function(data){
														return (data.timeSlotId == doc.id);
													});
													if(timeSlotExists.length > 0){

													}else{
														singleBoat[i].beingUsedBy.push(beingUsedByObj);
													}
													
													// setting id for used boat in order to update references for the time slot
													usedBoatId = singleBoat[i].id;
													
													// Removing extra size from the request becuase it is recently added in the timeslot and 
													// usedBoatCapacity is not updated.

													remainingCapacities.push(singleBoat[i].capacity - (usedBoatCapacity + parseInt(req.body.booking.size)));
												
													boatAssigned = true;
												} else {
													remainingCapacities.push(singleBoat[i].capacity - usedBoatCapacity);
												}
											} else {
												remainingCapacities.push(boatCapacity - usedBoatCapacity);
											}
										} else {

											//check whether the op cotains id of the current timeSlot
										}
								}

								//saving document
								singleBoat[i].save();

							}

							//if it is not null then update references in other timeslots in order to updated their availability.
							//updating customer count and availability

							if(usedBoatId != null){

								var newCustomerCount = parseInt(doc.customer_count) + parseInt(req.body.booking.size);
								doc.customer_count = newCustomerCount;
								var maxAvail = 0;
								for(var k = 0; k< remainingCapacities.length; k++){
									if(maxAvail < remainingCapacities[k]){
										maxAvail = remainingCapacities[k];
									}
								}


								remainingCapacities = [];
								doc.availability = maxAvail;


								// searching on dates which are 10 hours plus and minus so that we can consider potential overlapping sessions
								// of the boat and we can update availability of overlapping timeslot while considering overlapping timeslot
								// of overlapping timeslot for the current timeslot.
								var tempDate = new Date(doc.start_time);

								var docStartDate = new Date(tempDate.getTime() - (10 * 60 * 60000));
								var docEndDate = new Date(tempDate.getTime() + ((doc.duration + (10 * 60)) * 60000));

								//finding time slot which are overlapping and contains boat which is being used by the current time slot
								timeSlot.find({$or: [{start_time : {"$gt": docStartDate, "$lt": docEndDate}}, {end_time : {"$gt": docStartDate, "$lt": docEndDate}}]}, function(err, timeSlotsForUpdate) {
									
									//,"boatsDetails.id" : {$in: [usedBoatId]}
									// id: { $ne: doc.id }, 
									//$or: [{start_time : {"$gt": docStartDate, "$lt": docEndDate}}, {end_time : {"$gt": docStartDate, "$lt": docEndDate}}]
									console.log(timeSlotsForUpdate);

									var tsStartDate = new Date(doc.start_time);
									var tsEndDate = new Date(tsStartDate.getTime() + (doc.duration * 60000));

									for(var incr = 0; incr < timeSlotsForUpdate.length; incr++){

										if(( ( (timeSlotsForUpdate[incr].start_time > tsStartDate) && (timeSlotsForUpdate[incr].start_time < tsEndDate) ) || 
											( (timeSlotsForUpdate[incr].end_time > tsStartDate) && (timeSlotsForUpdate[incr].end_time < tsEndDate)) ||
											( ((tsStartDate > timeSlotsForUpdate[incr].start_time) && (tsStartDate < timeSlotsForUpdate[incr].end_time)) || 
											  ((tsEndDate > timeSlotsForUpdate[incr].start_time) && (tsEndDate < timeSlotsForUpdate[incr].end_time)) ))){

											var newAvailability = getUpdatedAvailability(timeSlotsForUpdate[incr] ,usedBoatId, timeSlotsForUpdate);
											timeSlotsForUpdate[incr].availability = newAvailability;
											timeSlotsForUpdate[incr].save();

										}
										
									}

									doc.save();
									return res.status(200).json({});
								});
							}else{
								doc.save();
								return res.status(200).json({});
							}
						});
					}
				}

			});
	});
}


//checking whether the boat is being used for the overlapping time interval or not
// Parametes 1) start_time - startTime of current timeSlot
//			 2) duration - duration ( which will be needed to filter the data )
//			 3) boatDocRes - boatDocument for which we have to check whether the overlapping timeSlots are present or not
//				for which this boat is being used
function isBoatBeingUsedForTheSameTimeInterval(start_time, duration, boatDocRes){

	var startDate = new Date(start_time);
	var endDate = new Date(startDate.getTime() + (duration * 60000));

	op = boatDocRes.beingUsedBy.filter(function(data){

		var dataStartTime = new Date(data.start_time);
		var dataEndTime = new Date(data.end_time);

		return ( (((startDate > dataStartTime) && (startDate < dataEndTime)) || ((endDate > dataStartTime) && (endDate < dataEndTime)) ) ||
			    ( ((dataStartTime > startDate) && (dataStartTime < endDate)) || ((dataEndTime > startDate) && (dataEndTime < endDate)) ));
	});

	//Returning Length
	return op.length;
}

//Get used capacity for the timeSlot for boatId
// Parameters 1) tsBoatsDetails - details of boatsDetails for timeSlot
// 			  2) boatId - boatId for the which used capacity needed for this timeSlot.
function getUsedCapacityForThisBoat(tsBoatsDetails, boatId){

	//filter data
	boatDetailsForTimeSlot = tsBoatsDetails.filter(function(data){
		return (data.id === boatId);
	});

	return boatDetailsForTimeSlot[0].usedSeats;

}


//Function which calculates mazimum availability for the given timeslot
// Arguments  1) timeSlotData = given Time slot
//			  2) boatId = boatId which was updated for the timeSlot
//			  3) wholeTimeSlotData = time slot data for a certain time range.
function getUpdatedAvailability(timeSlotData, boatId, wholeTimeSlotData) {
	
	var tsStartDate = new Date(timeSlotData.start_time);
	var tsEndDate = new Date(timeSlotData.end_time);

	//filtering data in order to check boat is being used in the other timeSlots or not and later we can update availability of timeslots accordingly.
	var filteredTS = wholeTimeSlotData.filter(function(data){

		var dataStartTime = new Date(data.start_time);
		var dataEndTime = new Date(data.end_time);

		return (( ((tsStartDate > dataStartTime) && (tsStartDate < dataEndTime)) || (( tsEndDate > dataStartTime) && ( tsEndDate < dataEndTime)) ) ||
				((dataStartTime > tsStartDate) && (dataStartTime < tsEndDate)) || (( dataEndTime > tsStartDate) && ( dataEndTime < tsEndDate)));
	});

	// array to include all the fields for the remaining capacity 
	var remainingAvailabilitiesForThisTimeSlot = [];
	
	var currentTimeSlotAvailability = timeSlotData.availability;

	for(var i = 0; i < timeSlotData.boatsDetails.length; i++){
		
		//If the capacity of time slot's availability is more than the boat which is being used then no need to update it
		if( timeSlotData.boatsDetails[i].id === boatId ){
			if(currentTimeSlotAvailability > timeSlotData.boatsDetails[i].capacity){
				continue;
			} else {
				remainingAvailabilitiesForThisTimeSlot.push(0);
			}
		} else {

			var flagForMarkingUsedBoats = false;
			//looping through filtered data to check the boat is being used in other timeSlot or not
			for(var j = 0; j < filteredTS.length; j++){

				for(var k =0 ; k < filteredTS[j].boatsDetails.length; k++){

					if(filteredTS[j].boatsDetails[k].id === timeSlotData.boatsDetails[i].id){
						if(filteredTS[j].boatsDetails[k].isBeingUsed){
							flagForMarkingUsedBoats = true;
							break;
						}
					}
				}

				if(flagForMarkingUsedBoats){
					break;
				}

			}

			//if boat is used in other time slot then we can not use it's capacity to show availability for the timeSlot
			// Hence updaing accordingly in below condition
			if(flagForMarkingUsedBoats){
				remainingAvailabilitiesForThisTimeSlot.push(0);
			} else {
				remainingAvailabilitiesForThisTimeSlot.push(timeSlotData.boatsDetails[i].capacity - timeSlotData.boatsDetails[i].usedSeats);	
			}
			// remainingAvailabilitiesForThisTimeSlot.push(timeSlotData.boatsDetails[i].capacity - timeSlotData.boatsDetails[i].usedSeats);
		}
	}

	//Getting maximun availability for the timeslot.
	var maxAvail = 0;
	for(var i = 0; i < remainingAvailabilitiesForThisTimeSlot.length; i++){
		if( remainingAvailabilitiesForThisTimeSlot[i] > maxAvail ){
			maxAvail = remainingAvailabilitiesForThisTimeSlot[i];
		}
	}

	return maxAvail;
}