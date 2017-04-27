/interface ethernet
set [ find default-name=ether1 ] comment=Internet name=ether1-gateway
set [ find default-name=ether6 ] comment="Gateway LAN" name=\
    ether6-master-local
set [ find default-name=ether7 ] master-port=ether6-master-local name=\
    ether7-slave-local
set [ find default-name=ether8 ] master-port=ether6-master-local name=\
    ether8-slave-local
set [ find default-name=ether9 ] master-port=ether6-master-local name=\
    ether9-slave-local
set [ find default-name=ether10 ] master-port=ether6-master-local name=\
    ether10-slave-local
/ip neighbor discovery
set ether1-gateway comment=Internet discover=yes
set ether6-master-local comment="Gateway LAN"
/ip address
add address=192.168.138.81/24 interface=ether6-master-local network=\
    192.168.138.0
/ip dhcp-client
add default-route-distance=0 dhcp-options=hostname,clientid disabled=no \
    interface=ether1-gateway use-peer-ntp=no
add add-default-route=no dhcp-options=hostname,clientid interface=\
    ether6-master-local use-peer-dns=no use-peer-ntp=no
/ip dns
set allow-remote-requests=no
/ip service
set ftp disabled=yes
set www disabled=yes
/system logging
set 1 action=disk
set 3 action=disk
/system ntp client
set enabled=yes primary-ntp=198.60.22.240 secondary-ntp=74.120.8.2
