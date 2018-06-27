// const WebSocket = require('ws');
// const agentProto = require('./protobufFiles/agent_pb');
// const assetProto = require('./protobufFiles/asset_pb');

// // Create websocket to the rest API
// const ws = new WebSocket('ws:localhost:8008/subscriptions', {
//     perMessageDeflate: false
// });
// // Set the websocket to listen for any state changes involving the lace transacton processor
// ws.on('open', function open() {
//     ws.send(JSON.stringify({
//         'action': 'subscribe',
//         'address_prefixes': ['22a6ae']
//     }))
// });

// // When new messages are received do this...
// // In this example, grab new value and print to console
// ws.on('message', function incoming(data) {
//     console.log('***data****');
//     console.log(data);

//     var type = JSON.parse(data).state_changes[0].address.charAt(6);
//     console.log('***type****');
//     console.log(type);

//     var newState = JSON.parse(data).state_changes[0].value;
//     console.log('***newState**** ');// + str(newState));
//     console.log(newState);

//     var data = Buffer.from(newState, 'base64')
//     console.log('***data****');
//     console.log(data);

//     data = new Uint8Array(data);
//     console.log('***data****' + data.length);
//     // console.log(data);

//     if(type == 2){
//         console.log('THIS IS A NEW AGENTTTTTTTTTTTTTT');
//         data = agentProto.AgentContainer.deserializeBinary(newState).toObject();
//     }
//     else if(type == 0) {
//         console.log('THIS IS A NEW ASSETTTTTTTTTTTTTT');
//         data = assetProto.AssetContainer.deserializeBinary(newState).toObject();
//     }
//     else {
//         console.log('HISTORY');
//     }
//     console.log(data);
//     // console.log(d2);
// });

const WebSocket = require('ws');
const agentProto = require('./protobufFiles/agent_pb');
const assetProto = require('./protobufFiles/asset_pb');
const historyProto = require('./protobufFiles/history_pb');
const db = require('./database.js');

// Create websocket to the rest API
const ws = new WebSocket('ws:localhost:8008/subscriptions', {
    perMessageDeflate: false
});
// Set the websocket to listen for any state changes involving the lace transacton processor
ws.on('open', function open() {
    ws.send(JSON.stringify({
        'action': 'subscribe',
        'address_prefixes': ['22a6ae']
    }))
});

// When new messages are received do this...
// In this example, grab new value and print to console
ws.on('message', function incoming(data) {
    console.log('\n\n****************************************');
    console.log('**************START OF TRANSACTION**************\n');

    var parsed_data = JSON.parse(data);

    console.log('STATE CHANGES:');
    for(i in parsed_data.state_changes) {
        console.log(parsed_data.state_changes[i]);
    }

    var numStateChanges = parsed_data.state_changes.length;
    console.log('\n- Number of state changes: ' + numStateChanges);

    var block_num = parsed_data.block_num;
    console.log('- BLOCK: ' + block_num);

    if (block_num == 0) {
        console.log('****************************************');
        return;
    }

    const types = ['ASSET', 'TOUCH/HISTORY', 'AGENT'];
    var type = parsed_data.state_changes[0].address.charAt(6);
    console.log('- TYPE: ' + types[type]);

    console.log('\n--------------------------------');
    console.log('-----START OF TRANSACTION EXTRACTION');

    var owner_pub_key = '020b0132a725e8fe6a6ee74a902cfc3f0bcbb7ae7b5d2218aad18b16df422a0f5d';
    var touchHistoryAsset = [false, false, false];
    var currentOwnerPublicKey = '';
    var touchpointTimestamp = '';
    // To hold new owner pub key, rfid, and timestamp
    var touchInfo = ['', '', ''];
    var assetInfo = ['', '', '', '', ''];
    var index;
    var HistoryCont;

    for(i in parsed_data.state_changes) {
        console.log('=============');

        var subtype = parsed_data.state_changes[i].address.charAt(6);
        console.log('Subtype: ' + subtype + '\n');

        var new_state = parsed_data.state_changes[i].value;
        data = Buffer.from(new_state, 'base64');
        data = new Uint8Array(data);

        // When an asset is created, add it to Company inventory(db)
        if (subtype == '0') {
            data = assetProto.AssetContainer.deserializeBinary(new_state).toObject();
            console.log('AN ASSET');
            console.log(data);
            data = data.entriesList[0];
            assetInfo[1] = data.rfid;
            assetInfo[2] = data.sku;
            assetInfo[3] = data.size;
            assetInfo[4] = (new Date).getTime();
            //db.addAsset(owner_pub_key, data.rfid, data.sku, data.size, (new Date).getTime());
            touchHistoryAsset[2] = true;
        }
        else if (subtype == '1') {
            // history if last four chars of address == 0000

            if (parsed_data.state_changes[i].address.slice(-4) == '0000') {
                HistoryCont = historyProto.HistoryContainer.deserializeBinary(new_state).toObject();

                console.log('A HISTORY');
                console.log(HistoryCont);
                touchInfo[1] = HistoryCont.entriesList[0].rfid;

                // History of all past owners
                console.log(HistoryCont.entriesList[0].reporterListList);
                // The most recent touchpoint is in the last index.
                var historylength = HistoryCont.entriesList[0].reporterListList.length;
                assetInfo[0] = HistoryCont.entriesList[0].reporterListList[0].publicKey;
                // data = data.entriesList[0].reporterListList[0];
                data = HistoryCont.entriesList[0].reporterListList[historylength - 1];
                console.log(historylength);
                console.log(data.publicKey);

                touchInfo[0] = data.publicKey;
                currentOwner = data;
                touchHistoryAsset[1] = true;

            }
            else { // When an item in the db is touched, change owner
                data = historyProto.TouchPointContainer.deserializeBinary(new_state).toObject();
                console.log('A TOUCH');
                index = data.entriesList[0].reporterIndex;
 
                //currentOwner = historyinfo.entriesList[0].reporterListList[index];
                //console.log('current: ' + currentOwner)

                console.log(data);
                touchpointTimestamp = data.entriesList[0].timestamp;
                touchInfo[2] = data.entriesList[0].timestamp.toString();
                touchHistoryAsset[0] = true;
            }
            // console.log(data);
        }
        else if (subtype == '2') {
            data = agentProto.AgentContainer.deserializeBinary(new_state).toObject();
            console.log('AN AGENT');
            console.log(data);
            data = data.entriesList[0];
            console.log('ADDING: ' + data.name + ':' +data.publicKey);
            db.addAgent(data.publicKey, data.name);
            

        }
        console.log('=============');
    }
    

    

    // If the transaction involved a touch and a history but not an asset
    // perform touch in db.
    if(touchHistoryAsset[0] && touchHistoryAsset[1] && !touchHistoryAsset[2]) {
        pub_key = HistoryCont.entriesList[0].reporterListList[index].publicKey;
        touchInfo[0] = pub_key;
        // console.log('Touch info: ' + touchInfo[0] + ' ' + touchInfo[1] + ' ' + touchInfo[2]);
        for(i in touchInfo) {
            console.log(touchInfo[i]);
        }
        db.touchAsset(touchInfo[0], touchInfo[1], touchInfo[2]);
    }
    else if(touchHistoryAsset[2]) {
        pub_key = HistoryCont.entriesList[0].reporterListList[index].publicKey;
        touchInfo[0] = pub_key;
        for(i in assetInfo) {
            console.log(assetInfo[i]);
        }
        db.addAsset(assetInfo[0], assetInfo[1], assetInfo[2], assetInfo[3], assetInfo[4]);
    }
    console.log('--------------------------------');
    console.log('--------------------------------');

    console.log('****************************************');
    console.log('****************************************');
    console.log('\n\n');
});