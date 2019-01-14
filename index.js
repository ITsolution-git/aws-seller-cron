require('dotenv').config();
const http = require("http");
var app = require("./app");
var cron = require('node-cron');
var MongoClient = require("mongodb").MongoClient;
var ObjectId = require("mongodb").ObjectId;
var OneSignal = require('onesignal-node');
var URL = process.env.MONGO_URL;
var moment =  require('moment');
const port = process.env.PORT || 3000;

const server = http.createServer(app);

var myClient = new OneSignal.Client({    
   userAuthKey: 'MjljYzViY2MtOTY1YS00MmI0LTk5ZDgtODU4MzlkZDNkZmEz',    
   app: { appAuthKey: 'OTZmZTcwZDYtMWI1MC00NmE1LThlMjItODllZjg3MjUyMTk3', appId: '0b6427d6-620b-457e-bd39-2cb8058ff542' }
});  

// A1QXOO488UYCC3
runCron();
cron.schedule('*/3 * * * *', () => {
	runCron();
});


function runCron() {
	MongoClient.connect(URL, function(err, db) {
	    if (err) throw err;
	    var collection = db.collection("users");
	    var users = collection
			.find({})
			.toArray()
			.then(result => {
		        result.map(async (res) => {
					var amazonMws = require('amazon-mws')(process.env.AWS_ACCESS_KEY, process.env.SECRET_KEY);	
					// var diff = Math.abs(new Date() - new Date(res['last_date']));
					// var minutes = Math.floor((diff/1000)/60);
					let reponse;
					console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! ' + moment(res['last_date']).subtract(3, 'minutes').format() + ' ' + moment().subtract(3, 'minutes').format());

					try {
						try {
				         	response = await amazonMws.orders.search({
					        	'Version': '2013-09-01',
							    'Action': 'ListOrders',
							    'SellerId': res['seller_id'],
							    'MWSAuthToken': res['mws_auth_token'],
				             	'MarketplaceId.Id.1': res['market_place_id'],
				             	// 'LastUpdatedAfter': moment(res['last_date']).format(),
							    'CreatedAfter': moment(res['last_date']).subtract(3, 'minutes').format(),
							    'CreatedBefore': moment().subtract(3, 'minutes').format(),
							    // 'CreatedAfter': '2019-01-01T10:04:01-05:00',
							    // 'CreatedBefore': '2018-12-17T10:09:01-05:00',
							    
							    // 'CreatedAfter': moment().subtract(3, 'minutes').format(),
							    // 'LastUpdatedAfter': '2018-12-14T02:10:01-05:00',
							    'OrderStatus.Status.1': 'Pending'
							});
						} catch(err) {
							console.log('Fetching order', err);
							return ;
						}

			         	console.log(response.Orders.Order);
						delete res.last_date;
					    collection
				      	.update(
					        { _id: ObjectId(res['_id']) },
					        { last_date: new Date(), ...res }
				      	)

						if (!response.Orders.Order) {
							return;
						}
						let orders = Array.isArray(response.Orders.Order) ? response.Orders.Order : [response.Orders.Order];
					    for (var i = 0; i < orders.length; i++) {
					    	let order = orders[i];
					    	try{
					       		let responseOrderItem = await amazonMws.orders.search({
								    'Version': '2013-09-01',
								    'Action': 'ListOrderItems',
						    		'SellerId': res['seller_id'],
								    'MWSAuthToken': res['mws_auth_token'],
								    'AmazonOrderId' : order['AmazonOrderId'],
								}); 
								try{
									console.log(responseOrderItem.OrderItems);
									let orderItems = Array.isArray(responseOrderItem.OrderItems.OrderItem) ? responseOrderItem.OrderItems.OrderItem : [responseOrderItem.OrderItems.OrderItem];
									let message = '';
									for (let j = 0; j < orderItems.length; j ++) {
										let orderItem = orderItems[j];

										let product = await amazonMws.products.searchFor({
									        'Version': '2011-10-01',
									        'Action': 'GetLowestPricedOffersForSKU',
									        'SellerId': res['seller_id'],
										    'MWSAuthToken': res['mws_auth_token'],
							             	'MarketplaceId': res['market_place_id'],
									        'SellerSKU': orderItem.SellerSKU,
									        'ItemCondition': 'New'
									    });

										let orderCount = orderItem.QuantityOrdered;
										let productTitle = (orderItem.Title.length > 20? orderItem.Title.slice(0,20)+'...' : orderItem.Title);
										let price = '', cCode = '';

										if(product.Summary.BuyBoxPrices) {
											try {
												price = product.Summary.BuyBoxPrices.BuyBoxPrice.ListingPrice.Amount;
												cCode = product.Summary.BuyBoxPrices.BuyBoxPrice.ListingPrice.CurrencyCode;
											} catch (err) {
												price = product.Summary.BuyBoxPrices.BuyBoxPrice[0].ListingPrice.Amount;
												cCode = product.Summary.BuyBoxPrices.BuyBoxPrice[0].ListingPrice.CurrencyCode;
											}
										}

										message += orderCount + ' ' + productTitle + (price ? ' in ' + price + ' ' + cCode : ''); 
										if (j !== orderItems.length - 1) {
											message += ', ';
										}
									}

									let pDate = moment(order.PurchaseDate).utc().format('YYYY-MM-DD HH:mm:ss');
								 	message += ' at ' + pDate + ' ' + order.SellerOrderId
									
									var notification = new OneSignal.Notification({    
									    contents: {    
									        en: message
									    },
									    title: 'New Order'
									});
									console.log(message);
									notification.postBody["filters"] = [{"field": "tag", "key": "userId", "relation": "=" ,"value": ObjectId(res['_id'])}];
									notification.postBody["included_segments"] = ["Active Users"];    
									notification.postBody["excluded_segments"] = ["Banned Users"];
									myClient.sendNotification(notification)
								    .then(function (response) {
								        console.log(response.data, response.httpResponse.statusCode);
								    })
								    .catch(function (err) {
								        console.log('Something went wrong...', err);
								    });
							    }catch(error){
				        			console.log('~~~~~~~~~~~ too many request ~~~~~~~~~~~ error ', error);
							    }

							} catch(error){
				        		console.log('~~~~~~~~~~~ too many request ~~~~~~~~~~~ error ', error);
							}
						}
		         	} catch(error) {
				        console.log('~~~~~~~~~~~ too many request ~~~~~~~~~~~ error ', error);
					}
	        	})
	      	});
  	});
}

console.log("running on http://localhost:" + port);
server.listen(port);
