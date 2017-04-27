var Client = require('ssh2').Client;
var conn = new Client();  //These are required for the SSH connection
var updateFiles = ['ntp-6.37.1-mipsbe.npk', 'routeros-mipsbe-6.37.1.npk'];
conn.info = {
    ip: "192.168.88.1",
    port: 22,
    username: "admin",
    password: "",
    settingsFile: 'C2TVSGAT1.rsc'
};

//First we need to connect to the station, get the MAC, and set that as the
connect(conn);

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

conn.on('ready', function(err) {
    if (err) throw err;
    configureRouter();
});

function configureRouter()
{
    uploadAndConfigure(function(results) {
        if (results.success) {
            updateRouter(updateFiles, 1, updateFinished);
        }
    });
}

function updateFinished() {
    console.log("Router finished.\n");
    sendCommand('/system reset-configuration no-defaults=yes run-after-reset=C2TVSGAT1.rsc', function(results) {
        if (results.success)
            conn.end();
    });
}

function uploadAndConfigure(cb)
{
    uploadFile(conn.info.settingsFile, conn.info.settingsFile, function() {
        console.log("Settings file uploaded.")
        cb({success:true, data:null, err:null});
    });
}


function uploadFile(localPath, remotePath, cb) {
    conn.sftp(function(err, sftp) {
        if (err) throw err;
        console.log("Uploading file: " + remotePath);
        sftp.fastPut(localPath, remotePath, cb);
    });
}

function updateRouter(updateFiles, counter, cb) //Make sure to start counter at 1 when first calling this.
{
    uploadFile(updateFiles[counter-1], updateFiles[counter-1], function(err)
    {
        if (err) throw err;
        if (counter < (updateFiles.length))
        {
            counter++;
            updateRouter(updateFiles, counter, cb)
        }
        else
            cb({success:true, data:counter + " files uploaded.", err:null});
    });
}

function sendCommand (command, cb) //This ensures the callback will not initiate untill all data is received from the command.
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
    });
}