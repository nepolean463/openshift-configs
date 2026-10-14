
root@nepo-OptiPlex-3060:~# cat /etc/dnsmasq.d/ocp4.conf 
# Listen only on the main interface (eth0)
interface=enp1s0
#bind-interfaces

#address=/registry.ocp4.example.com/192.168.1.8

# OpenShift cluster domains -> SNO node
#address=/api.ocp4.testing.io/192.168.1.8
#address=/api-int.ocp4.testing.io/192.168.1.8
#address=/.apps.ocp4.testing.io/192.168.1.8

address=/api.okd4.example.com/192.168.1.8
address=/api-int.okd4.example.com/192.168.1.8
address=/.apps.okd4.example.com/192.168.1.8

address=/api.ocp4.example.com/192.168.1.8
address=/api-int.ocp4.example.com/192.168.1.8
address=/.apps.ocp4.example.com/192.168.1.8

#address=/.registry.ocp4.example.com/192.168.1.7
address=/registry.ocp4.example.com/127.0.0.1

# Upstream DNS for everything else
server=8.8.8.8
server=1.1.1.1


root@nepo-OptiPlex-3060:~# 



root@nepo-OptiPlex-3060:~# cat /etc/dnsmasq.d/libvirt-daemon
bind-interfaces
except-interface=virbr0
root@nepo-OptiPlex-3060:~# 

