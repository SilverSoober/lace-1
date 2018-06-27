var express = require('express');
var router = express.Router();
var request = require('./request');
var txns = require('./TransactionCreator');
var address = require('../addressing');
var history_pb = require('../protobufFiles/history_pb');
var asset_pb = require('../protobufFiles/asset_pb');

var profileKey = undefined;
if (process.env.EXTENDED_KEYS) {
    profileKey = require('../agentKeysExtended.json');
} else{
    profileKey = require('../agentKeys.json');
}

if (process.env.SEND_KEYS) {
    // Creates agents and sends to validator Comment out if you dont want to add clients at start up
    addAgents(); 
}


// Create a mapping of public keys to names
const publicKeyMap = mapPublicKeysToNames(profileKey)


// Make request on server end
router.post('/api/send/:user', async function(req, res){
    var agentPubPriKey = getKeys(req.params.user); 
    var payload = {
        Action: 0,
        ModelID: req.body.model,
        Size: req.body.size,
        SkuID: req.body.sku,
        RFID: req.body.rfid,
        Date: req.body.date,
        PublicKey: agentPubPriKey["public_key"],
        PrivateKey: agentPubPriKey["private_key"]
    }
    var response = await request.send(payload);
    sendResponseToClient(res, response);
});

router.post('/api/touch/:user', async function(req, res){
    var agentPubPriKey = getKeys(req.params.user);
    var payload = {
        Action: 2,
        RFID: req.body.rfid,
        PublicKey: agentPubPriKey["public_key"],
        PrivateKey: agentPubPriKey["private_key"]
    }
    var response = await request.send(payload);
    sendResponseToClient(res, response);
});

//A Function to get the history of an item from its RFID. 
router.post('/api/history/:user', async function(req, res) {
    var agentPubPriKey = getKeys(req.params.user);
    var response = await request.getHistory(address.makeAllHistoryAddress(req.body.RFID));
    if(!request.errorCheckResponse(response))
    {
        SendErrorReponseToClient(res);
        return;
    }

    var instanceArray = [];
    var dataList = JSON.parse(response.body).data;

    if(dataList[0] === undefined) {
        res.statusCode = 404;
        res.send(instanceArray);
        return;
    }

    // Decode the history page container first
    var buffer = new Buffer(dataList[0].data, 'base64');
    var uInt = new Uint8Array(buffer);
    var instance = history_pb.HistoryContainer.deserializeBinary(uInt).toObject();

    // Find the correct history page in the container
    instance.entriesList.forEach(entry => {
        if (entry.rfid == req.body.RFID) {
            instanceArray[instanceArray.length] = entry;
        }
    })

    // Decode the remaining touchpoint containers
    for (i = 1; i < dataList.length; i++) {
        buffer = new Buffer(dataList[i].data, 'base64');
        uInt = new Uint8Array(buffer);
        instance = history_pb.TouchPointContainer.deserializeBinary(uInt).toObject();

        // Add an entry to the touchpoint that maps the pub key to a name
        var touchPoint = instance.entriesList[0];
        touchPoint.name = publicKeyMap.get(instanceArray[0].reporterListList[touchPoint.reporterIndex].publicKey);
        instanceArray[instanceArray.length] = touchPoint;
    }

    var infoResponse = await request.getAssetInfo(address.makeAssetAddress(req.body.RFID));
    if(!request.errorCheckResponse(infoResponse))
    {
        SendErrorReponseToClient(res);
        return;
    }
    var infoData = JSON.parse(infoResponse.body).data;
    var infoBuffer = new Buffer(infoData[0].data, 'base64');
    var uIntInfo = new Uint8Array(infoBuffer);
    var infoInstance = asset_pb.AssetContainer.deserializeBinary(uIntInfo).toObject();
    instanceArray[instanceArray.length] = infoInstance;

    
    res.statusCode = 200;
    res.send(instanceArray);
});

router.post('/api/reserve/:user', async function(req, res){
    var agentPubPriKey = getKeys(req.params.user);
    var response = await request.getHistory(address.makeAllHistoryAddress(req.body.RFID));
    if(!request.errorCheckResponse(response))
    {
        SendErrorReponseToClient(res);
        return;
    }

    var instanceArray = [];
    var dataList = JSON.parse(response.body).data;

    if(dataList[0] === undefined) {
        res.statusCode = 404;
        res.send(instanceArray);
        return;
    }

    // Decode the history page container first
    var buffer = new Buffer(dataList[0].data, 'base64');
    var uInt = new Uint8Array(buffer);
    var instance = history_pb.HistoryContainer.deserializeBinary(uInt).toObject();

    // Find the correct history page in the container
    instance.entriesList.forEach(entry => {
        if (entry.rfid == req.body.RFID) {
            instanceArray[instanceArray.length] = entry;
        }
    })

    // Decode the remaining touchpoint containers
    for (i = 1; i < dataList.length; i++) {
        buffer = new Buffer(dataList[i].data, 'base64');
        uInt = new Uint8Array(buffer);
        instance = history_pb.TouchPointContainer.deserializeBinary(uInt).toObject();

        // Add an entry to the touchpoint that maps the pub key to a name
        var touchPoint = instance.entriesList[0];
        touchPoint.name = publicKeyMap.get(instanceArray[0].reporterListList[touchPoint.reporterIndex].publicKey);
        instanceArray[instanceArray.length] = touchPoint;
    }

    var infoResponse = await request.getAssetInfo(address.makeAssetAddress(req.body.RFID));
    if(!request.errorCheckResponse(infoResponse))
    {
        SendErrorReponseToClient(res);
        return;
    }
    var infoData = JSON.parse(infoResponse.body).data;
    var infoBuffer = new Buffer(infoData[0].data, 'base64');
    var uIntInfo = new Uint8Array(infoBuffer);
    var infoInstance = asset_pb.AssetContainer.deserializeBinary(uIntInfo).toObject();
    instanceArray[instanceArray.length] = infoInstance;

    
    res.statusCode = 200;
    res.send(instanceArray);
});


router.post('/api/status/:user', async function(req, res){    
    var response = await request.getStatus(address.makeAssetAddress(req.body.url));
    if(!request.errorCheckResponse(response))
    {
        SendErrorReponseToClient(res);
        return;
    }

    var buffer = new Buffer(response, 'base64');
    var uInt = new Uint8Array(buffer);
    var instance = asset_pb.AssetContainer.deserializeBinary(uInt).toObject();

    res.statusCode = 200;
    res.send(instance);
});


function SendErrorReponseToClient(res){
    res.statusCode = response.statusCode;
    res.send("Invalid request status Code " + response.statusCode);
    res.end;
}

function getKeys(agent){
    return(profileKey[agent]);
}

function mapPublicKeysToNames(profileJSON) {
    var map = new Map();
    for (var key in profileJSON) {
       if (profileJSON.hasOwnProperty(key)) {
           map.set(profileJSON[key].public_key, key)
        }
    }
    return map
}

function sendResponseToClient(res, response){
    if(!request.errorCheckResponse(response))
    {
        SendErrorReponseToClient(res);
        return;
    }

    res.statusCode = 200;
    res.send(response.body);
}

function addAgents(){
    const batchSigner = txns.signerFromPrivateKey(profileKey["Company"]["private_key"]);

    var payload = {
        Action: 1,
        Name: "",
        PublicKey: "",
        PrivateKey: "",
    }

    var transactions = [];
    for(var agent in profileKey){
        payload.Name = agent;
        payload.PublicKey = (profileKey[agent]["public_key"]);
        payload.PrivateKey = (profileKey[agent]["private_key"]);
        var signer = txns.signerFromPrivateKey(payload.PrivateKey);
        transactions[transactions.length] = txns.createTransactionBytes(signer, batchSigner, txns.createTransaction(payload))
    }
    const batchBytes = txns.createBatchListBytesFromMany(batchSigner, transactions);
    request.submit(batchBytes);
}

module.exports = router;
