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
var utilFunc = require('./utilFunc');

var flagVar = false;
var globalVersion;
module.exports = function(app){

	app.post('/api/assignments', function(req, res){

		//API to assign boat to a timeSlot
		/*	
			Parameters:
				assignment[timeslot_id]
					A valid timeslot id
					Example: abc123
				assignment[boat_id]
					A valid boat id
					Example: def456
				Output:
					none
		*/
		
		//validating parameters

		if((req.body.assignment.timeslot_id == null) || (req.body.assignment.boat_id == null)){
			//standard response code is 422 but right now I am using 400 as of now.
			return res.status(400).json(errorResponse("Make sure all required parameter/parameters are included in the request...!", 400));
		} else {

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

			    		var lengthOftheResult = utilFunc.isBoatBeingUsedForTheSameTimeInterval(doc.start_time, doc.duration, boatDoc);

			    		//creating a doc for adding a new boat in timeSlot
					    var boatDetailsData = {
					    	id : req.body.assignment.boat_id,
					    	capacity : boatDoc.capacity,
					    	isBeingUsed : false,
					    	usedSeats : 0
					    }

					    //If the boat is being used for the same time interval in other timeSlot then no need to update timeSlot Availability.
			    		if(lengthOftheResult > 0){
			    			//do nothing
			    		}else{
			    			if(doc.availability < boatDoc.capacity ) {
				    			doc.availability = boatDoc.capacity;
				    		}
			    		}
			    	//Sacing the timeSlot and sending empty response to the client.
			    	doc.boatsDetails.push(boatDetailsData);
			    	doc.save();
			    	return res.status(200).json({});
			    });
			});
		}
		
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


		//validating parameters

		if((req.body.booking.timeslot_id == null) || (req.body.booking.size == null)){
			//standard response code is 422 but right now I am using 400 as of now.
			return res.status(400).json(errorResponse("Make sure all required parameter/parameters are included in the request...!", 400));
		} else {

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


						// Finding boats which are assigned for the current timeSlot to book tickets for customers.
						boat.find({id: {$in: boatIds}}, function(err, singleBoat){
							// getting data for all boats which are being used by this timeSlot


							// Looping through all the boats
							for(var i = 0; i < singleBoat.length; i++){

								var usedBoatCapacity = utilFunc.getUsedCapacityForThisBoat(doc.boatsDetails, singleBoat[i].id);
								console.log("---------------------");
								console.log(usedBoatCapacity);

								// If the boat is not being used in any other time slots
								if(singleBoat[i].beingUsedBy.length == 0){
								//boat is not being used in any of the timeSlot
								// In this case we can skip the step of checking overlapping timeslot as no other time slot is using this boat

									if(singleBoat[i].capacity >= parseInt(req.body.booking.size)) {
										//This boat can handle new booking of the given size - passes the condition

										if(boatAssigned != true){

											var date = new Date(doc.start_time);
											var endDate = new Date(date.getTime() + (doc.duration * 60000));


											// creating beingUsedBy object to enter in the database for boats.
											var beingUsedByObj = {
												timeSlotId : doc.id,
												start_time : date,
												end_time : endDate
											};
											
											// getting index for the boat in timeslot to update boatsDetails for the boat
											var index;
											for(var z = 0; z < doc.boatsDetails.length; z++) {
											   if(doc.boatsDetails[z].id === singleBoat[i].id) {
											   		index = z;
											     	break;
											   }
											}

											//updating detila on document for timeSlot and later we will save this.
											doc.boatsDetails[index].isBeingUsed = true;
											doc.boatsDetails[index].usedSeats = doc.boatsDetails[index].usedSeats + parseInt(req.body.booking.size);

											// Pushing new object in order to add details for new timeSlot details for the boat
											singleBoat[i].beingUsedBy.push(beingUsedByObj);

											//setting id for used boat in order to update references for other timeSlots at a later stage
											usedBoatId = singleBoat[i].id;


											// pushing remaining capacity for the current timeSlot for the current boat to calculate maximum remaning availability at a later stage.
											remainingCapacities.push((singleBoat[i].capacity - parseInt(req.body.booking.size)));
											singleBoat[i].markModified(singleBoat[i].beingUsedBy);
											
											doc.markModified(doc.boatsDetails);

											//Setting this flag to be true so that in other boat's details we will not update capacity details.
											boatAssigned = true;
										} else {

											//if boat is already assigened then only push
											// remaining capacity for the current timeSlot for the current boat to calculate maximum availability after this booking.
											remainingCapacities.push((singleBoat[i].capacity - (usedBoatCapacity)));
										}
									} else {

										// if boat can not hanlde the cooking capacity then add it's remaning capacity for 
										// the current timeSlot in an array to get max availability after this booking
										remainingCapacities.push(singleBoat[i].capacity - usedBoatCapacity);
									}

								} else {

										// Now boat is being used by other timeSlots.

										// Check if the boat is currently being used by any overlapping timeSlots
										var lengthOfOverLappingTimeSlots = utilFunc.isBoatBeingUsedForTheSameTimeInterval(doc.start_time, doc.duration, singleBoat[i]);

										if(lengthOfOverLappingTimeSlots == 0){
											//if it is not being used in the certain time interval. Then it is free to be used by any time interval
											
											boatCapacity = singleBoat[i].capacity;

											// check if the boat can hanlde booking size.
											if((boatCapacity- usedBoatCapacity) >= parseInt(req.body.booking.size)) {

												//This boat can handle new booking of the given size
												// If any previous assignment is not done then add the booking
												if(boatAssigned != true){


													// getting index of the boat in the timeSlot
													var index;

													for(var z = 0; z < doc.boatsDetails.length; z++) {
													   if(doc.boatsDetails[z].id === singleBoat[i].id) {
													   		index = z;
													     	break;
													   }
													}

													// getting usedBoatExisits for this timeSlot
													usedBoatExists = doc.boatsDetails.filter(function(data){
														return ((data.id === singleBoat[i].id) && (data.isBeingUsed == true));
													});
													
													// If it is exists then update value accordingly and if it is not then update details accordingly.
													if(usedBoatExists.length > 0){
														// updating usedSeats and isBeingUsed is already set.
														if(doc.boatsDetails[index].usedSeats == singleBoat[i].capacity){
															doc.boatsDetails[index].usedSeats = singleBoat[i].capacity;
														} else {
															doc.boatsDetails[index].usedSeats = doc.boatsDetails[index].usedSeats + parseInt(req.body.booking.size);
														}

														//doc.boatsDetails[index].usedSeats = doc.boatsDetails[index].usedSeats + parseInt(req.body.booking.size);
													}else{
														// setting isBeingUsed true and usedSeats timeSlot
														doc.boatsDetails[index].isBeingUsed = true;
														doc.boatsDetails[index].usedSeats =  doc.boatsDetails[index].usedSeats + parseInt(req.body.booking.size);	

														// adding beingUsedBy for the boat
														var date = new Date(doc.start_time);
														var endDate = new Date(date.getTime() + (doc.duration * 60000));
														

														// Creating a beingUsedBy object to add if this boat does not have this timeSlot in it
														var beingUsedByObj = {
															timeSlotId : doc.id,
															start_time : date,
															end_time : endDate
														};

														singleBoat[i].beingUsedBy.push(beingUsedByObj);
													}
													
													// setting id for used boat in order to update references for the time slot
													usedBoatId = singleBoat[i].id;
													
													// Removing extra size from the request becuase it is recently added in the timeslot and 
													// usedBoatCapacity is not updated.

													// adding into remainingCapacities to calculate max availability for this timeSlot
													remainingCapacities.push(singleBoat[i].capacity - (usedBoatCapacity + parseInt(req.body.booking.size)));
												
													boatAssigned = true;
												} else {
													// adding into remainingCapacities to calculate max availability for this timeSlot
													remainingCapacities.push(singleBoat[i].capacity - usedBoatCapacity);
												}
											} else {
												// adding into remainingCapacities to calculate max availability for this timeSlot
												remainingCapacities.push(boatCapacity - usedBoatCapacity);
											}
										} else {

											// We will not add the boat's remaining capacity as it will not be counted for the current timeSlot.
										}
								}

								//saving document
								singleBoat[i].save();

							}

							//if usedBoatId is not null then update references in other timeslots in order to updated their availability.

							if(usedBoatId != null){

								//updating customer count and availability
								var newCustomerCount = parseInt(doc.customer_count) + parseInt(req.body.booking.size);
								doc.customer_count = newCustomerCount;
								var maxAvail = 0;
								for(var k = 0; k< remainingCapacities.length; k++){
									if(maxAvail < remainingCapacities[k]){
										maxAvail = remainingCapacities[k];
									}
								}

								// assigning null array to remainingCapacities and setting maxAvailability to the timeSlot
								remainingCapacities = [];
								doc.availability = maxAvail;


								//Checking other timeSlots which are using the boat with usedBoatId for availability and updating theier availability.

								// searching on dates which are 10 hours plus and minus so that we can consider potential overlapping sessions
								// of the boat and we can update availability of overlapping timeslot while considering overlapping timeslot
								// of overlapping timeslot for the current timeslot.
								var tempDate = new Date(doc.start_time);
								
								// Variable to set date range in order to find timeSlot in the that range and update them for availability.
								var HOURS_UNIT = 24;

								var docStartDate = new Date(tempDate.getTime() - (HOURS_UNIT * 60 * 60000));
								var docEndDate = new Date(tempDate.getTime() + ((doc.duration + (HOURS_UNIT * 60)) * 60000));

								//finding time slot which falls in the above date range to update for availability
								timeSlot.find({$or: [{start_time : {"$gt": docStartDate, "$lt": docEndDate}}, {end_time : {"$gt": docStartDate, "$lt": docEndDate}}]}, function(err, timeSlotsForUpdate) {
									
									//,"boatsDetails.id" : {$in: [usedBoatId]}
									// id: { $ne: doc.id }, 
									//$or: [{start_time : {"$gt": docStartDate, "$lt": docEndDate}}, {end_time : {"$gt": docStartDate, "$lt": docEndDate}}]
									//console.log(timeSlotsForUpdate);

									var tsStartDate = new Date(doc.start_time);
									var tsEndDate = new Date(tsStartDate.getTime() + (doc.duration * 60000));

									// Here calling util function to get the newAvailability in order to update.
									for(var incr = 0; incr < timeSlotsForUpdate.length; incr++){

										// Condition to check overlapping timeSlots for the current timeSlot.
										if(( ( (timeSlotsForUpdate[incr].start_time > tsStartDate) && (timeSlotsForUpdate[incr].start_time < tsEndDate) ) || 
											( (timeSlotsForUpdate[incr].end_time > tsStartDate) && (timeSlotsForUpdate[incr].end_time < tsEndDate)) ||
											( ((tsStartDate > timeSlotsForUpdate[incr].start_time) && (tsStartDate < timeSlotsForUpdate[incr].end_time)) || 
											  ((tsEndDate > timeSlotsForUpdate[incr].start_time) && (tsEndDate < timeSlotsForUpdate[incr].end_time)) ))){

											var newAvailability = utilFunc.getUpdatedAvailability(timeSlotsForUpdate[incr] ,usedBoatId, timeSlotsForUpdate);
											timeSlotsForUpdate[incr].availability = newAvailability;
											timeSlotsForUpdate[incr].save();
										}	
									}

									// saving document
									doc.save();
									return res.status(200).json({});
								});
							}else{

								// saving document
								doc.save();
								return res.status(200).json({});
							}
						});
					}
				}

			});

		}
	
	});
}