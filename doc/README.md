# ewbf-collect
ewbf's cuda miner collector for InfluxDB & Grafana

![alt text]( https://drive.google.com/uc?id=17jISPvGw8gNrFWY1PF0ZnjHbY77w2wQJ "")


## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development, testing  and purposes. 

### Prerequisites

These things do you need to install the software:

```
Desktop computer with Ubuntu / Debian OS, or RASPBERRY PI 3 with Raspbian OS

Node.js® 8.11.3 - is a JavaScript runtime built on Chrome's V8 JavaScript engine.
InfluxDB 1.5.2 - the Time Series Database in the TICK Stack
Grafana 5.1.3 - the leading open source software for time series analytics
```


## Installing prerequisites on Ubuntu


[Install Ubuntu desktop](https://tutorials.ubuntu.com/tutorial/tutorial-install-ubuntu-desktop)

[Install Node.js on Ubuntu](https://github.com/miningtools/ewbf-collect/blob/master/doc/install_nodejs_ubuntu.md)

[Install InfluxDB on Ubuntu](https://github.com/miningtools/ewbf-collect/blob/master/doc/install_influxdb_ubuntu.md)

[Install Grafana on Ubuntu](https://github.com/miningtools/ewbf-collect/blob/master/doc/install_grafana_ubuntu.md)

## Installing prerequisites on Raspbian

[What is a Raspberry Pi?](https://www.youtube.com/watch?v=gbJB3387xUw)

[Install Raspbian](https://www.raspberrypi.org/documentation/installation/noobs.md)

[Install Node.js on Raspbian](https://github.com/miningtools/ewbf-collect/blob/master/doc/install_nodejs_raspbian.md)

[Install InfluxDB on Raspbian](https://github.com/miningtools/ewbf-collect/blob/master/doc/install_influxdb_raspbian.md)

[Install Grafana on Raspbian](https://github.com/miningtools/ewbf-collect/blob/master/doc/install_grafana_raspbian.md)


### Open terminal window and update Operating System and install requirement packages

> user@host:~$ sudo apt-get update && sudo apt-get upgrade -y 
> 
> user@host:~$ sudo apt-get install -y curl git apt-transport-https

### Create user for ewbf-collect service 

> user@host:~$ sudo useradd --home-dir /home/collector --create-home --shell /bin/bash --system --user-group --groups sudo collector
>
> user@host:~$ sudo passwd collector 
>

```
Enter new UNIX password:
Retype new UNIX password:
```

> user@host:~$ sudo su - collector


### Create ewbf-collect database
> collector@host:~$ influx
```
Connected to http://localhost:8086 version 1.5.2
InfluxDB shell version: 1.5.2
```
> \> create database "ewbf-collect"
> 
> \> show databases
```name: databases
name
----
_internal
ewbf-collect
```
> \> exit


### Install Singlestat-Math plugin for Grafana
> collector@host:~$ sudo grafana-cli plugins install blackmirror1-singlestat-math-panel

### Restart grafana
##### on Ubuntu
> collector@host:~$ sudo systemctl restart grafana-server  

##### on Raspbian

> collector@host:~$ sudo service grafana-server restart

### Enable ewbf's cuda miner API acces on rigs
 
sample config file :
```

[common]
cuda_devices 0 1 2 3 4 5
intensity    64 64 64 64 64 64
templimit    83
pec          0
boff         0
eexit        1
tempunits    c
log          2
logfile      /applogs/miners/ewbf-btg.log
api          0.0.0.0:42000
algo         144_5
pers         BgoldPoW

# main server
[server]
server btg.2miners.com
port   4040
user  GLtZTKSEbhCjTGPmrXbgeaeBBrz6B97wJT
pass  password

```
##### start ewbf miner on windows
>  C:\\ewbfminer> miner.exe --config miner.cfg
##### start ewbf miner on linux 
>  user@rig:/opt/ewbfminer$ ./miner --config miner.cfg

or without config file 
##### windows
> C:\ewbfminer> miner --algo 144_5 --pers BgoldPoW --server btg.2miners.com --port 4040 --user GLtZTKSEbhCjTGPmrXbgeaeBBrz6B97wJT --api 0.0.0.0:42000 
##### linux 
>  user@rig:/opt/ewbfminer$ ./miner --algo 144_5 --pers BgoldPoW --server btg.2miners.com --port 4040 --user GLtZTKSEbhCjTGPmrXbgeaeBBrz6B97wJT --api 0.0.0.0:42000 

### Install ewbf-collect

> collector@host:~$ git clone https://github.com/miningtools/ewbf-collect.git
> 
> collector@host:~$ cd ewbf-collect/
>
> collector@host:~/ewbf-collect/$ npm install
>
> collector@host:~/ewbf-collect/$ cp ./config/hosts.config.sample.js ./config/hosts.config.js

### Config ewbf-collect 


hosts config file: config/hosts.config.js (**need to edit before first run ewbf-collect**)
```
...
  { name: 'rig1a', address: 'localhost', port: 42000 },
  { name: 'rig1b', address: '127.0.0.1', port: 42001 },
  { name: 'rig2', address: '10.236.6.200', port: 42000 },
...
```

daemon config file: config/daemon.config.js
```
...
    user: "collector",
    group: "collector",
...
```

InfluxDB config file: config/influx.config.js
```
...
influx.db = {
        host:'localhost',
        port:'8086',
        name:'ewbf-collect'
}
...
```


### Create ewbf-collect service

> collector@host:~/ewbf-collect/$ sudo su - 

> root@host:~$ cat  <<'EOF' > /lib/systemd/system/ewbf-collect.service
>
> [Unit]
>
> Description=ewbf-collect is an open-source ewbf miner collector
> 
> Documentation=https://github.com/miningtools/ewbf-collect
>  
> After=network-online.target
>
> &nbsp;
> 
> [Service]
> 
> Type=forking
> 
> Environment=NODE_ENV=prod
> 
> WorkingDirectory=/home/collector/ewbf-collect/
> 
> ExecStart=/home/collector/ewbf-collect/ewbf-collect start
> 
> ExecStop=/home/collector/ewbf-collect/ewbf-collect stop
> 
> Restart=always
> 
> StandardOutput=syslog
> 
> StandardError=syslog
>
> SyslogIdentifier=ewbf-collect
>
> &nbsp; 
>
> [Install]
>
> WantedBy=multi-user.target
>
> Alias=ewbf-collect.service
>
> EOF

> root@host:~$ systemctl daemon-reload
> 
> root@host:~$ exit



### Enable ewbf-collect service

> collector@host:~$ sudo systemctl enable ewbf-collect

### Start ewbf-collect service

> collector@host:~$ sudo systemctl start ewbf-collect

### Check ewbf-collect service

> collector@host:~$ sudo systemctl status ewbf-collect



Login to Grafana with **admin/admin**

![alt text](https://drive.google.com/uc?id=1ajajwCI7s-Aez7DuXTD2kQtxYUykprDD "")

Go to Configuration / Data Sources

![alt text](https://drive.google.com/uc?id=1K_5CvPObiq_47yEBvSpBjHuSAmTWKEFa "")

Click "Add data source" button

![alt text](https://drive.google.com/uc?id=1on4OLH0fnFLc7143f9foUlxSAkrRE1rZ "")

the next page will have to fill in some input fields

Name: ewbf-collect

Type: InfluxDB 

URL: http://localhost:8086

Check in "Skip TLS Verification" checkbox  

Database: ewbf-collect

then click Save & Test

![alt text](https://drive.google.com/uc?id=1hvyK8WCrHnAwBGuJJ_eYskSkt4oIz2sO "")


Next Go to Create Dashboard / Import

![alt text](https://drive.google.com/uc?id=1zKwd4LQoqdKUTtvv_voryKe8lh2q1MQu "")


The Grafana.com Dashboard id is **7530**

![alt text](https://drive.google.com/uc?id=1fueSQrB81mNgWbXv6MYiYOCgL5AP_EFX "")


click "Import" button

![alt text](https://drive.google.com/uc?id=1kfLbOaPmvFX3gr9Ab-hQ1c7r0yZ1ePe8 "")



---
### Run ewbf-collect

#### Production mode
> collector@host:~/ewbf-collect/$ export NODE_ENV=prod
> 
> collector@host:~/ewbf-collect/$ sudo ./ewbf-collect start 

or 
> collector@host:~/ewbf-collect/$ sudo systemctl start ewbf-collect

#### Testing mode   

> collector@host:~/ewbf-collect/$ export NODE_ENV=test
> 
> collector@host:~/ewbf-collect/$ node index.js

#### Development mode   

> collector@host:~/ewbf-collect/$ export NODE_ENV=dev
> 
> collector@host:~/ewbf-collect/$ node index.js


---



## Versioning

* v1.0.1.

## Authors

* **tsab** - *Initial work* - [MiningTools](https://github.com/miningtools)

See also the list of [contributors](https://github.com/miningtools/ewbf-collect/contributors) who participated in this project.

## License

This project is licensed under the GNU License - see the [LICENSE.md](https://github.com/miningtools/ewbf-collect/blob/master/LICENSE) file for details
