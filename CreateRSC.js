var exports = module.exports;
var fs = require('fs'); //this initializations the filesystem api built into node.js
var generationRange = [0,0]; //Make sure to set this to the desired range for generated passwords
var stationUsername = ""; //set to desired station username.
var bridgeUsername = ""; //set to desired bridge username.
var charset = ""; //set the valid characters for password generation

function generaterandomkey() 
{
    var length = generaterandom(generationRange[0], generationRange[1]),
        retval = "";
    for (var i = 0, n = charset.length; i < length; ++i) {
        retval += charset.charAt(Math.floor(Math.random() * n));
    }
    return retval;
}
    
function generaterandom(min, max)
{
    return Math.random() * (max - min) + min;
}

exports.createRSC = function(ssid, cb) {
    var stationPassword = generaterandomkey();
    var bridgePassword = generaterandomkey();
    var generatedSSIDkey = generaterandomkey();
    var stationIP = '192.168.88.2';
    var bridgeIP = '192.168.88.3'; //These are the IPs that will be set after configuration for final login attempts.
    var command = '/interface bridge\n'+
    'add name=bridge1\n'+
    '/interface wireless security-profiles\n'+
    'add authentication-types=wpa2-psk eap-methods="" management-protection=\\ \n'+
    '    allowed mode=dynamic-keys name=ptp supplicant-identity="" \\ \n'+
    '    wpa2-pre-shared-key='+generatedSSIDkey+'\n'+
    '/interface wireless\n'+
    'set [ find default-name=wlan1 ] band=2ghz-b/g/n country="united states" \\ \n'+
    '    disabled=no frequency-mode=regulatory-domain mode=station-bridge \\ \n'+
    '    security-profile=ptp ssid='+ssid+' wireless-protocol=802.11\n'+
    '/ip hotspot profile\n'+
    'set [ find default=yes ] html-directory=flash/hotspot\n'+
    '/interface bridge port\n'+
    'add bridge=bridge1 interface=wlan1\n'+
    'add bridge=bridge1 interface=ether1\n'+
    '/ip address\n'+
    'add address=192.168.88.2/24 interface=ether1 network=192.168.88.0\n'+
    '/ip dhcp-client\n'+
    'add default-route-distance=0 dhcp-options=hostname,clientid disabled=no \\ \n'+
    '    interface=bridge1\n'+
    '/system leds\n'+
    'add interface=wlan1 leds=led1,led2,led3,led4,led5 type=\\ \n'+
    '    wireless-signal-strength\n'+
    '/system routerboard settings\n'+
    'set protected-routerboot=disabled\n'+
    '/file remove flash/station.rsc\n'+
    '/user\n'+
    'add name="'+stationUsername+'" password="'+stationPassword+'" group="full"\n'+
    'remove admin\n';
    fs.writeFile("station.rsc", command, function(err)
    {
        if (err) throw err;
        command = command.replace("mode=station-bridge", "mode=bridge");
        command = command.replace(stationPassword, bridgePassword);
        command = command.replace(stationUsername, bridgeUsername);
        command = command.replace("address=192.168.88.2/24", "address=192.168.88.3/24");
        command = command.replace('remove flash/station.rsc', 'remove flash/bridge.rsc')
        fs.writeFile("bridge.rsc", command, function(err) {
            if (err) throw err;
            var results = {
                success: true,
                data: {
                    stationFile:'station.rsc',
                    bridgeFile:'bridge.rsc',
                    stationPassword:stationPassword,
                    bridgePassword:bridgePassword,
                    ssidKey:generatedSSIDkey,
                    stationIP:stationIP, 
                    bridgeIP:bridgeIP,
                    stationUsername: stationUsername,
                    bridgeUsername: bridgeUsername
                },
                err: null
            };
            cb(results);
        });
    });
};

