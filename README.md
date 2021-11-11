### About the project

    SensorHub is a distribuited-system based on the client-server model that allows you 
    to manage, store and control your home environmental statistics. 
    The system is composed by four entities : the server, the database, the mcu set,
    and the website. 

## Server 

    Manages the request that come from the mcu's and from the client and the activities related to the database.
    
## The mcu set

    Every time time that the server make a request to a specific mcu, the mcu perform the measure that are releated to the request and submit the result. 
    This data are stored by the server into the database.

## Website

    A client, can interact with the system throught a website that allow him to check and display the current status of devices and sensors, and do queries 
    to the database.  

## Database 
    
    For each mcu store the mcu hardware specification, the sensor list, the network info, and the device activity. For each sensor store the model, the type.
    Every time that a measure is done store the result.

## Requisites
    
    A server machine that is compatible with :  
  
        1. Node.js v14.18.0
        2. MongoDB v
    
    One or more mcu with :
  
        1. 60 kbyte of ROM.
        2. Compatibility with Arduino framework.
        3. Network access.
        4. One ADC module.
        5. One timer module.
        6. 3 GPIO port.
