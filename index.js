require('dotenv').config();
const http = require("http");
var app = require("./app");
var cron = require('node-cron');
var MongoClient = require("mongodb").MongoClient;
var ObjectId = require("mongodb").ObjectId;

var URL = process.env.MONGO_URL;

const port = process.env.PORT || 3000;

const server = http.createServer(app);
// var io = require("socket.io")(server);
// io.origins("*:*");
// io.on("connection", function(socket) {
//   console.log("a user connected");
// });

// const Pusher = require("pusher");

// const pusher = new Pusher({
//   appId: "528462",
//   key: "edc0fafa92d65aa9bace",
//   secret: "f5f7bb64d29de2bb3092",
//   cluster: "us2",
//   encrypted: true
// });

MongoClient.connect(URL, function(err, db) {
    if (err) throw err;
    var collection = db.collection("users");
    var users = collection
      .find({})
      .toArray()
      .then(result => {
        result.map( (res) => {
			var amazonMws = require('amazon-mws')(res['aws_access_key_id'], res['secret_key']);			
			// var diff = Math.abs(new Date() - new Date(res['last_date']));
			// var minutes = Math.floor((diff/1000)/60);
	        cron.schedule('5 * * * *', () => {
	         amazonMws.orders.search({
	             'Version': '2013-09-01',
	             'Action': 'ListOrders',
	             'SellerId': res['seller_id'],
	             // 'MWSAuthToken': 'MWS_AUTH_TOKEN',
	             'MarketplaceId.Id.1': res['market_place_id'],
	             'LastUpdatedAfter': res['last_date']
	         }, function (error, response) {
	             if (error) {
	                 console.log('error ', error);
	                 return;
	             }
	             response.Orders.Order.map(console.log);
	         });
	        });
			delete res.last_date;
		    collection
		      .update(
		        { _id: ObjectId(res['_id']) },
		        { last_date: new Date(), ...res }
		      )
        })
        
      });
  });


console.log("running on http://localhost:" + port);
server.listen(port);
