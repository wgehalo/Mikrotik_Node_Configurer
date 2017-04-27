var fileManager = require("./CreateRSC.js");
var notesLib = require("./intranetAPI.js")
var Client = require('ssh2').Client;
var stationConn = new Client();  //These are required for the SSH connection
var bridgeConn = new Client();
var readline = require('readline');
var serial = null;
var manjob = null;
var intranetUser = ""
var intranetPassword = ""
var r1 = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

stationConn.info = {port:22, ip:"192.168.88.1", futureIP:"", futureUsername:"", futurePassword:"", eMAC:"", wMAC:"", ssid:"", username:"admin", password:"", ssidKey:"", settingsFile:"", name:'station'};
bridgeConn.info = {port:22, ip:"192.168.88.1", futureIP:"", futureUsername:"", futurePassword:"", eMAC:"", wMAC:"", ssid:"", username:"admin", password:"", ssidKey:"", settingsFile:"", name:'bridge'};
stationConn.readyCallback = configureStation; //We set the callbacks for the ready connection to configure the router first.
bridgeConn.readyCallback = configureBridge; //We will set them to test the connections when we connect a second time.
stationConn.closeCallback = defaultCloseCallback;
bridgeConn.closeCallback = defaultCloseCallback;

var updateFiles = ['ntp-6.37.1-mipsbe.npk', 'routeros-mipsbe-6.37.1.npk'];

r1.question("Enter serial: ", (answer) => {
    serial = answer;
    r1.question("Enter manjob: ", (answer1) => {
        manjob = answer1;
        connect(stationConn);
    })
})

function connect(conn, options)
{
    var info = {
        host: conn.info.ip,
        port: conn.info.port,
        username: conn.info.username,
        password: conn.info.password
    }
    if (options && options.readyTimeout)
    info.readyTimeout = options.readyTimeout;
    conn.connect(info);
}

function configureStation()
{
    getMACs(stationConn, function(results) {
        if (results.success)
        {
            //now we have our MAC addresses and we can create the setting files using ethernetMAC as the ssid
            stationConn.info.eMAC = results.data.ethernetMAC;
            stationConn.info.wMAC = results.data.wirelessMAC;
            stationConn.info.ssid = stationConn.info.eMAC.replace(/:/g,"");
            bridgeConn.info.ssid = stationConn.info.ssid;
            fileManager.createRSC(stationConn.info.ssid, fileCreationDone)
        }
    });
}

function configureBridge()
{
    getMACs(bridgeConn, function(results) {
        if (results.success)
        {
 //Don't need to do much here, getting MACs for info.
            bridgeConn.info.eMAC = results.data.ethernetMAC;
            bridgeConn.info.wMAC = results.data.wirelessMAC;
            //Now we can upload the files for this like we did the station.
            uploadAndConfigure(bridgeConn, function(results) { 
            if (results.success) {
                //lets store the new info and then reboot the router
                bridgeConn.info.ip = bridgeConn.info.futureIP;
                bridgeConn.info.username = bridgeConn.info.futureUsername;
                bridgeConn.info.password = bridgeConn.info.futurePassword;
                resetRouter(bridgeConn, bridgeRebooting);
            }
        });
        }
    });
}

function printInfo() {
    var info = 'SERIAL: '+serial+'\n'+
    'SSID: ' + stationConn.info.ssid+'\n'+
    'SSID Key: ' + stationConn.info.ssidKey+'\n'+
    '\n'+
    'STATION:\n'+
    stationConn.info.eMAC+'\n'+
    stationConn.info.wMAC+'\n'+
    'Username: '+stationConn.info.username+'\n'+
    'Password: '+stationConn.info.password+'\n'+
    '\n'+
    'BRIDGE:\n'+
    bridgeConn.info.eMAC+'\n'+
    bridgeConn.info.wMAC+'\n'+
    'Username: '+bridgeConn.info.username+'\n'+
    'Password: '+bridgeConn.info.password+'\n'+
    '--------------------------------------------------';
    console.log(info);
    notesLib.setUsernamePassword("intranetUser","intranetPassword");
    notesLib.appendManjobNotes(manjob, info, function(err,res) {
        console.log(`err: ${err} res: ${res}`);
    });
} 

function bridgeRebooting()
{
    //There we are, both done, now we will test the routers to see if we can login.
    //So we set the onReady callbacks to the test function
    //let's test'
    bridgeConn.readyCallback = function() {
        console.log("Bridge configured successfully, deleting static IP.")
        testRouter(bridgeConn);
    };
    stationConn.readyCallback = function() {
        console.log("Station configured successfully, deleting static IP.")
        testRouter(stationConn);
        printInfo();
    }
    stationConn.closeCallback = defaultCloseCallback;
    bridgeConn.closeCallback = defaultCloseCallback;
    //Now we just have to connect, but we will wait 90 seconds before doing so.
    setTimeout(function(){
        connect(stationConn);
        connect(bridgeConn);
    }, 120000);
}

function testRouter(conn)
{

    try {
        sendCommand(conn, '/ip address remove numbers=0', function(results) {
            console.log("YESYESYESYEEYESYEYSEYSEYSEYASFKJSDGFLKSDJGLSKDJGSLDKGJSLKDGJ");
            console.log(results.toString());
            conn.end();
        });
    }
    catch(err) {
        console.log(err);
    }
     //Have to end connection here, once we remove IP the connection gets reset and ssh module throws an error.
}

function defaultCloseCallback(code, signal)
{
    console.log("Connection closed unexpectedly.");
}

stationConn.on('close', function(code, signal) {
    console.log("Station connection closed.")
    stationConn.end();
    stationConn.closeCallback(); //Now we invoke our dynamic callback. 
});

bridgeConn.on('close', function(code, signal) {
    console.log("Bridge connection closed.")
    bridgeConn.end();
    bridgeConn.closeCallback(); //Now we invoke our dynamic callback. 
});

function startBridgeConfiguration()
{
    console.log("Logging into bridge for configuration.");
    setTimeout(function(){
        connect(bridgeConn);
    }, 90000); //We have to wait 90 seconds for the station to come back up or we get a timeout error.
}

stationConn.on('ready', function(err) { //now we are connected, time to get the MAC addresses
    if (err) throw err;
    stationConn.readyCallback();
});

fileCreationDone = function(results) //we come here when the setting files are created
{
    if (results.success);
    {
        stationConn.info.futurePassword = results.data.stationPassword;
        stationConn.info.ssidKey = results.data.ssidKey;
        bridgeConn.info.futurePassword = results.data.bridgePassword
        bridgeConn.info.ssidKey = results.data.ssidKey;
        stationConn.info.futureIP = results.data.stationIP;
        bridgeConn.info.futureIP = results.data.bridgeIP;
        stationConn.info.futureUsername = results.data.stationUsername;
        bridgeConn.info.futureUsername = results.data.bridgeUsername;
        stationConn.info.settingsFile = results.data.stationFile;
        bridgeConn.info.settingsFile = results.data.bridgeFile;
        console.log("Created files:\n"+results.data.stationFile + '\n' + results.data.bridgeFile);
 //Now that we have the information we will upload the upgrade and settings files to the station
        uploadAndConfigure(stationConn, function(results) { 
            if (results.success) {
                //The station is now updated, now we run the reset command and move onto the bridge.
                resetRouter(stationConn, stationRebooting);
            }
        });
       
    }
}

bridgeConn.on('ready', function(err) { //This will fire after the bridge connection is ready.
    if (err) throw err;
    bridgeConn.readyCallback();
});

bridgeConn.on('error', function(err) {
    //console.log(err);
    bridgeConn.end();
});

stationConn.on('error', function(err) { 
    //console.log(err);
    stationConn.end();
});

function stationRebooting(results) //Our station is configured, now we reboot and start bridge configuration once the connection is closed.
{
    if (results.success) {
        console.log("Station configured and rebooting.\n" + results.data);
        stationConn.info.ip = stationConn.info.futureIP;
        stationConn.info.username = stationConn.info.futureUsername;
        stationConn.info.password = stationConn.info.futurePassword;
        stationConn.closeCallback = startBridgeConfiguration; //Set the callback to start bridge configuration once the station connection is closed.
    }
}

function resetRouter(conn, cb)
{
    console.log('system reset-configuration no-defaults=yes run-after-reset=flash/'+conn.info.settingsFile);
    sendCommand(conn, 'system reset-configuration no-defaults=yes run-after-reset=flash/'+conn.info.settingsFile, cb);
}

function uploadAndConfigure(conn, cb)
{
    uploadFile(conn, conn.info.settingsFile, 'flash/'+conn.info.settingsFile, function() {
        console.log("Settings file uploaded.")
        updateRouter(conn, updateFiles, 1, cb);
    });
}


function uploadFile(conn, localPath, remotePath, cb) {
    conn.sftp(function(err, sftp) {
        if (err) throw err;
        console.log("Uploading file: " + remotePath);
        sftp.fastPut(localPath, remotePath, cb);
    });
}

function updateRouter(conn, updateFiles, counter, cb) //Make sure to start counter at 1 when first calling this.
{
    uploadFile(conn, updateFiles[counter-1], updateFiles[counter-1], function(err)
    {
        if (err) throw err;
        if (counter < (updateFiles.length))
        {
            counter++;
            updateRouter(conn, updateFiles, counter, cb)
        }
        else
            cb({success:true, data:counter + " files uploaded.", err:null});
    });
}



function getMACs (conn, cb) {
    var completedOperations = 0;
    var ethernetMAC = null;
    var wirelessMAC = null;
    sendCommand(conn, '/interface ethernet print', function(results)
    {
        if(results.success) {
            ethernetMAC = /([A-Fa-f0-9]{2}:?){6}/.exec(results.data);
            completedOperations++;
            processCallback();
        }
        else console.log (results.err);
    })

    sendCommand(conn, '/interface wireless print', function(results)
    {
        if(results.success) {
            wirelessMAC = /([A-Fa-f0-9]{2}:?){6}/.exec(results.data);
            completedOperations++;
            processCallback();
        }
        else console.log (results.err);
    })

    function processCallback() {
        if (completedOperations == 2)
        {
            if (wirelessMAC) wirelessMAC = wirelessMAC[0];
            if (ethernetMAC) ethernetMAC = ethernetMAC[0];
            cb({success:true, err:null, data:{wirelessMAC: wirelessMAC, ethernetMAC:ethernetMAC}})
        }
        else if (completedOperations > 2)
            cb({success:false, err:"More than 2 operations", data:null});
    }
};

function sendCommand (conn, command, cb) //This ensures the callback will not initiate untill all data is received from the command.
{
    var allData = "";
    conn.exec(command, function(err, stream) {
        if (err) cb ({success:false, err:err, data:null});
        stream.on('data', function(data){
            allData += data.toString();
        });
        stream.on('close', function(code, signal) {
            cb({success:true, err:null, data:allData});
        });
        stream.stderr.on('data', function(data) {
            cb({success:false, err:null, data:data})
        });
    });
}
