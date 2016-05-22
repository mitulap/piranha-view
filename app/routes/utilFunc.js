//Util functions for data processing and getting results for APIs

module.exports = {
	//checking whether the boat is being used for the overlapping time interval or not
	// Parametes 1) start_time - startTime of current timeSlot
	//			 2) duration - duration ( which will be needed to filter the data )
	//			 3) boatDocRes - boatDocument for which we have to check whether the overlapping timeSlots are present or not
	//				for which this boat is being used
	isBoatBeingUsedForTheSameTimeInterval : function (start_time, duration, boatDocRes){

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
	},


	//Get used capacity for the timeSlot for boatId
	// Parameters 1) tsBoatsDetails - details of boatsDetails for timeSlot
	// 			  2) boatId - boatId for the which used capacity needed for this timeSlot.
	getUsedCapacityForThisBoat : function(tsBoatsDetails, boatId){

		//filter data
		boatDetailsForTimeSlot = tsBoatsDetails.filter(function(data){
			return (data.id === boatId);
		});

		return boatDetailsForTimeSlot[0].usedSeats;

	},


	//Function which calculates mazimum availability for the given timeslot
	// Arguments  1) timeSlotData = given Time slot
	//			  2) boatId = boatId which was updated for the timeSlot
	//			  3) wholeTimeSlotData = time slot data for a certain time range.
	getUpdatedAvailability : function(timeSlotData, boatId, wholeTimeSlotData) {
		
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
};