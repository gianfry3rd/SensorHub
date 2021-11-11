# SensorHub

SensorHub is a distribuited-system based on the client-server model that allows you  to manage, store and control your home environmental statistics. 

## About the system

The system is composed by four entities : the server, the database, the mcu set, and the website. 
  
### Server 

Manages the request that come from the MCU's and from the client and the activities related to the database.
    
### MCU set

Every time time that the server make a request to a specific MCU, the mcu perform the measure that are releated to the request and submit the result. This data are stored by the server into the database.

### Website

A client, can interact with the system throught a website that allow him to check and display the current status of devices and sensors, and do queries 
to the database.  

### Database 

The database is managed only by the server application, but can be consulted by the website.
    
For each MCU store :

- hardware specification
- sensor list 
- network info 
- MCU activity
- planned routine
    
For each sensor store : 

- model
- type

For each measure store :

- result 
- timestamp
- sensor ID

For each routine store :

- related MCU operation
- timestamp creation
- timestamp last enable
- timestamp last disable 
 
## Requisites
    
A server machine that is compatible with :  

1. Node.js v14.18.0
2. MongoDB v
    
One or more mcu with :
  
1. 60 kbyte of ROM.
2. Compatibility with Arduino framework.
3. Network access.
4. ADC 10bit res.
6. 3 GPIO port.

Sensor :

1. DHT sensor
2. HC_SR_501 sensor
3. Photoresistor 

## Libraries

MCU

- ArduinoJson 6.18.5
- EthernetWebServer_STM32
- EthernetHttpClient_STM32
- DHT

Website 

- Chart.js

## Installation

1. Download and install Node.js v14.18.0 and mongoBD on server machine.
2. Download and install the Arduino IDE.
3. Configure the IDE.
4. Download and install all the libraries listed below.
5. Open a new project and paste the sensor_hub.cpp file content.
6. Upload the code.
7. Run the server.

## What is implemented 

1. MCU : registration.
2. MCU : login.
3. MCU : tempetature and humidity upload.
4. MCU : presence advice upload.
5. MCU : luminosity upload.

1. Server : database management. 
2. Server : MCU registration.
3. Server : MCU login.
4. Server : MCU logout (not working)
5. Server : Client queries.

## What is not implemented 

1. Website
