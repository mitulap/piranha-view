# piranha-view
This is a server for Piranha View application. This project contains APIs which are built using Node.js 

## Client Repo
https://github.com/gadabout/passport

Client is a UI application from where you can test this APIs.

## Running the API server

To test this APIs in client you need to run this server.
This server requires following things to be installed on your machine
* Node and npm in order to run this Node server
* MongoDB database installed and server of mongoDB database has to be running as this application uses MongoDB database.
 
Follow below steps to run this server
* Clone this repo in your local machine. 
* Using terminal go to the root path of cloned folder.
* do `npm install` to install all the required packages and node modules
* do `npm server.js` - this will run this application server on localhost port 3000

You API server is running and you can access client for testing of this API.

## Few Things Regarding this APIs
* This API is not optimized to use for two request concurrently. It means if you are trying to access and update any resource in a single request and you are running such multiple request concurrently or with less time interval in between then this APIs will fail. The reason is that MongoDB data base is eventually consistent for this application and I have not implemented any locks for such request as of now.
* This API does not contian DELETE operations.


Feel free to contact me at mitulpatel.hsd@gmail.com for any discussion.
