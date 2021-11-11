const http = require('http');
const { MongoClient } = require('mongodb');
var ObjectID = require('mongodb').ObjectID
class Parser
{
    #_reqLineReg = /POST\s((\/login)|(\/register)|(\/logout))\sHTTP\/1.1/;
    #_resLineReg = /POST\sHTTP\/1.1\s200\sOK/;
    #_deviceJsonReg = /{"_id":\d+,"mcu":"\w+","board":"\w+"}/;
    #_loginJsonReg = /{"_id":\d+,"local_port":\d+ "IP":\[\d{1,3},\d{1,3},\d\d{1,3},\d{1,3}\]}"/;
    #_sensorJsonReg = /\[{"sensor":{"_id":\d+,"dev_id":\d+,"model":"\w+","type":"\w+"}},+\]/
    #_tempHumJsonReg = /{"_id":\d+,"temp":\d+\.\d+,"hum":\d+\.\d+}/
    #_lumJsonReg = /{"_id":\d+,"lum":"\d+"}/
    #_presenceJson = /{"_id":\d+,"prTime:"\d+"}/   
    static #_instance;        
    static getInstance()
    { 
        return !Parser.#_instance ? Parser.#_instance = new Parser() : Parser.#_instance;
    }
    constructor(){}
    #_parseReqLine(line)
    { 
        return line.match(this.#_reqLineReg).length == 1 ? true : false; 
    }
    #_parseResLine(line)
    { 
        return line.match(this.#_resLineReg).length == 1 ? true : false; 
    }
    #_parseTempHumJson(tempHum)
    { 
        return tempHum.match(this.#_tempHumJsonReg).length == 1 ? true : false; 
    }
    #_parseLumJson(lum)
    { 
        return lum.match(this.#_lumJsonReg).length == 1 ? true : false; 
    }
    #_parseSensListJson(list)
    { 
        return list.match(this.#_sensorJsonReg).length == 1 ? true : false; 
    }
    #_parsePresenceJson(type)
    { 
        return list.match(this.#_sensorJsonReg).length == 1 ? true : false;                   
    }
    #_parseLoginJson(type)
    { 
        return list.match(this.#_loginJsonReg).length == 1 ? true : false;                 
    }
    #_parseDeviceJson(type)
    { 
        return list.match(this.#_deviceJsonReg).length == 1 ? true : false;
    }
    parseDevRequest(line, req)
    {
        if(!this.#_parseReqLine(line))
            return 0;
        switch(req)
        {
            case "/login" :
                return this.#_parseLoginJson(req) ? 1 : 0;          
            case "/register" :
                return !this.#_parseDeviceJson(req) ? 2 : 0;          
            case "/presence" :
                return !this.#_parsePresenceJson(req) ? 3 : 0;    
        }      
    }
    parseResRequest(line, req)
    {
        if(!this.#_parseResLine(line))
            return 0;
        switch(req)
        {
            case "/tempHum" : 
                return !this.#_parseLoginJson(req) ? 1 : 0;          
            case "/lum" :
                return !this.#_parseDeviceJson(req) ? 2 : 0;          
            case "/sensorList" :
                return !this.#_parseDeviceJson(req) ? 3 : 0;           
        }      
    }
    getSensorType(type)
    {
        switch(type)
        {
            case 0 :
                return "Temperature-humidity";
            case 1 :
                return "Passive, infrared";
            case 2 :
                return "Passive, photoresistor";
        }
    }
    getSensorModel(model)
    {
        switch(model)
        {
            case 0 :
                return "DHT_11";
            case 1 :
                return "HC_501_SR";
            case 2 :
                return "RES";
        }
    }
};

class DataBaseManager
{   
    #_mongoClient;
    #_sensorDB;
    static #_instance = null;        
    static async getInstance()
    { 
        if(!DataBaseManager.#_instance)
        {
            DataBaseManager.#_instance = new DataBaseManager() 
            await DataBaseManager.#_instance.#init();
        }
        return DataBaseManager.#_instance;
    }
    async #init() 
    {
        this.#_mongoClient = new MongoClient("mongodb://localhost:27017");
        await this.#_mongoClient.connect();
        this.#_sensorDB = await this.#_mongoClient.db("sensorhub"); 
        await this.#_sensorDB.command({ping: 1});
        console.log("Connected successfully to db")
    }
    constructor(){}
    async devExist(id)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection("device", {strict : true});
        const count = await col.countDocuments({_id : id});
        return count ? true : false;
    }
    async devLogged(id)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection("device", {strict : true});
        const count = await col.countDocuments({_id : id, logged : true});
        return count ? true : false;
    }
    async readLoggedDevice()
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection("device", {strict : true})
        let devList = await col.find({logged : true})
        return await devList.toArray();
    }
    async readCurrDevSess(devID)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection("device", {strict : true});
        const sessionID = await col.findOne({"_id" : devID}, {projection: {currentSession: 1, _id : 0}});
        return sessionID.currentSession;
    }
    async readLastIP(devID)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection("deviceSession", {strict : true});
        const sessionID = await this.readCurrDevSess(devID);
        const IP = await col.findOne({"_id" : ObjectID.createFromHexString(sessionID)}, {projection: {IP: 1, _id : 0}});
        return IP.IP;
    }
    async readLastPort(devID)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection("deviceSession", {strict : true});
        const sessionID = await this.readCurrDevSess(devID);
        const localPort = await col.findOne({"_id" : ObjectID.createFromHexString(sessionID)}, {projection: {localPort: 1, _id : 0}});
        return localPort.localPort;
    }
    async updateLogTimeInfo(sessionID, setter)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const devCol = await db.collection("deviceSession", {strict : true});
        await devCol.updateOne({ _id : ObjectID.createFromHexString(sessionID)}, setter);
    }
    async updateNetInfo(IP, localPort, sessionID)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const setter = {$set: {IP : IP, localPort : localPort}}
        const devCol = await db.collection("deviceSession", {strict : true});
        await devCol.updateOne({ _id : ObjectID.createFromHexString(sessionID)}, setter, {upsert : true});
    }
    async addDevSession(devID)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        let sessionID = null;
        let devSession = {"devID" : devID}; 
        const sesCol = await db.collection("deviceSession",{strict : true});
        const devCol = await db.collection("device",{strict : true});
        await sesCol.insertOne(devSession).then((r) => sessionID = r.insertedId.toHexString());
        await devCol.updateOne({ _id : devID}, {$set: {currentSession : sessionID}});
        return sessionID;
    }
    async updateDevStatus(devID, status)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const devCol = await db.collection("device", {strict : true});
        await devCol.updateOne({ _id : devID}, {$set: {logged : status}});
    }
    async readDevServiceTime(devID)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const devCol = await db.collection("device", {strict : true});
        return await devCol.findOne({_id : devID}, {projection : {_id : 0, ServiceTime : 1}}).serviceTime;
    }
    async readLogTime(devID)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const sesCol = await db.collection("deviceSession",{strict : true});
        const sessionID = await this.readCurrDevSess(devID);
        const lastLogin = await sesCol.findOne({_id : ObjectID.createFromHexString(sessionID)}, {projection: {_id : 0, lastLogin : 1}});
        return lastLogin.lastLogin;
    }
    async updateServiceTime(devID, sessionID)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const lastLogin = await this.readLogTime(devID); 
        const serviceTime = await this.readDevServiceTime(devID); 
        const devCol = await db.collection("device",{strict : true});
        const setter = {$set : {serviceTime : (new Date().getTime() - lastLogin.getTime()) + serviceTime}};
        await devCol.updateOne({_id : devID}, setter);
    }
    async login(devID, IP, localPort)
    {
        const sessionID = await this.addDevSession(devID);
        await this.updateDevStatus(devID, true);
        await this.updateNetInfo(IP, localPort, sessionID);
        await this.updateLogTimeInfo(sessionID, {$currentDate : {lastLogin : true}});
        const tp = await TaskPool.getInstance();
        await tp.startDevRoutine(devID);
    }
    async alive(devID, IP, localPort)
    {
        const sessionID = await this.readCurrDevSess(devID);
        await this.updateNetInfo(IP, localPort, sessionID);
        await this.updateServiceTime(devID, sessionID);
    }
    async logout(devID)
    {
        console.log("device : " + devID + " logout.");
        const sessionID = await this.readCurrDevSess(devID);
        const tp = await TaskPool.getInstance();
        await tp.stopDevRoutine(devID);
        await this.updateDevStatus(devID, false);
        await this.updateLogTimeInfo(sessionID, {$currentDate : {lastLogout: true}});
        await this.updateServiceTime(devID, sessionID);
    }
    async addDevice(dev)
    {
        const stillAlive = {"dev_id" : 1, "op" :  "stillAlive", "frequence" : 1500, "active" : true};
        await this.addRoutine(stillAlive, "plannedRoutine");
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection("device", {strict : true});
        return col.insertOne(dev);
    }
    async readDevOfSens(id)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection("sensor");        
        let sensor  = null;
        const objID = ObjectID.createFromHexString(id);
        console.log(objID);
        let sensorArray =  await col.find({_id: objID}, {projection : {dev_id : 1, _id : 0}});
        sensorArray = await sensorArray.toArray();
        console.log(sensorArray);
        return sensorArray[0].dev_id;
    }
    async sensorExist(id)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection("sensor");
        return await col.countDocuments({_id :  ObjectID.createFromHexString(id)});
    }
    async readDevSensorList(req)  
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection("sensor");        
        let sensorList  = null;
        if(req.type == "all")
            sensorList = await col.find({dev_id : req._id});
        else sensorList = await col.find({dev_id : req._id, type : req.type});
        sensorList = await sensorList.toArray();
        return sensorList;
    }
    async readSensID(dev, type)
    {
        const q = {"_id" : dev._id, "type": type};
        const devSensList = await this.readDevSensorList(q);
        let idList = [];
        for (var i = devSensList.length - 1; i >= 0; i--) 
            idList.push( {"_id" : devSensList[i]._id, "sens_num" : devSensList[i].s_num});
        return idList;
    }
    async readSensorList(req)  
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection("sensor");              
        let sensorList  = null
        if(req.type == "all")
            sensorList = await col.find();
        else sensorList = await col.find({type : req.type});
        sensorList = await sensorList.toArray();
        return sensorList;
    }
    async readStat(filter, projection, coll, param, sorter)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = db.collection(coll);
        let stat = await col.find(filter, projection);
        stat = await stat.toArray();
        stat = stat.sort(sorter);
        switch(param)  
        {
            case "min" :
                return stat[0];
            case "mid" :
                return stat[(stat.length - 1) / 2];
            case "max" :
                return stat[stat.length - 1];
            case "all" :
                return stat;
        }
        return null;
    }
    async #_updateSensorList(sensor)  
    {
        const parser = Parser.getInstance();
        sensor.model = parser.getSensorModel(sensor.model);
        sensor.type = parser.getSensorType(sensor.type);
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection("sensor");
        await col.insertOne(sensor);
    }
    async updateSensorList(sensorArray, id)
    {   
        for(let i = 0; i < sensorArray.length; i++)
        {
            sensorArray[i].dev_id = id;
            await this.#_updateSensorList(sensorArray[i]);
        }
    }  
    async #_postNewStat(coll, stat)  
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = db.collection(coll);
        stat.measureTime = new Date();
        let d = null;
        await col.insertOne(stat).then((stat) => d = stat.insertedId.toHexString());
        return d;
    }
    async postNewStat(coll, stat)
    {   
        return await this.#_postNewStat(coll, stat);
    }
    async #_readStatMsrTime(coll, id)
    {
        console.log("rid");
        console.log(id);
        const db = await this.#_mongoClient.db("sensorhub");
        const col = db.collection(coll);
        const mID = ObjectID.createFromHexString(id);
        const mTime = await col.findOne({_id: mID}, {projection : {measureTime : 1, _id : 0}});
        return mTime.measureTime;
    }
    async readStatMsrTime(coll, statID)
    {   
        return await this.#_readStatMsrTime(coll, statID);  
    }
    async updateStat(id, coll, setter)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection(coll, {strict : true});
        await col.updateOne({_id : ObjectID.createFromHexString(id)}, setter,{upsert : true}); 
    }
    async routineExist(id, collName)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection(collName, {strict : true});
        return col.countDocuments({_id : ObjectID.createFromHexString(id)});
    }
    async addRoutine(routine, collName)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection(collName, {strict : true});
        let id = null;
        await col.insertOne(routine).then((r) => id = r.insertedId.toHexString());
        await col.updateOne({_id : ObjectID.createFromHexString(id)},{$currentDate : {creation:true}});
        return id;        
    }
    async removeRoutine(routine, collName)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection(collName, {strict : true});
        await col.deleteOne({_id : ObjectID.createFromHexString(routine._id)});
    }
    async startRoutine(info, collName)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection(collName, {strict : true});
        await col.updateOne({_id : ObjectID.createFromHexString(info._id)},{$set : {active:true}});
        await col.updateOne({_id : ObjectID.createFromHexString(info._id)},{$currentDate : {lastEnable:true}});
    }
    async stopRoutine(info, collName)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection(collName, {strict : true});
        return col.updateOne({_id : ObjectID.createFromHexString(info._id)},{$set : {active:false}});
        await col.updateOne({_id : ObjectID.createFromHexString(info._id)},{$currentDate : {lastEnable:true}});
    }
    async readActiveRoutine(collName, devID)
    {
        const db = await this.#_mongoClient.db("sensorhub");
        const col = await db.collection(collName, {strict : true});
        let routineList = await col.find({active : true, dev_id : devID});
        routineList = await routineList.toArray();
        return routineList;
    }
};

class ClientRequestManager
{
    static #_dbManager;
    static #_instance = null;        
    static async getInstance()
    { 
        if(!ClientRequestManager.#_instance)
        {
            ClientRequestManager.#_instance = new ClientRequestManager() 
            this.#_dbManager =  await DataBaseManager.getInstance();
        }
        return ClientRequestManager.#_instance;
    }
    constructor (){}
    #sendResponse(res, code, msg, body)
    {
       // console.log("response " + " msg : " + msg " code : " + code + " to : ");
        console.log(body);
        console.log(msg);
        const str = JSON.stringify(body);
        res.statusCode = code;
        res.statusMessage = msg;
        res.setHeader("Content-Length", str.length);
        res.setHeader("Connection","close");
        res.write(str);
        res.end();
    }
    #_getDevSensorList(dev, res)
    {
        const dbm = ClientRequestManager.#_dbManager;
        dbm.devExist(dev).then( 
            exist => exist ? dbm.readDevSensorList(dev).then( 
                (queryRes) => this.#sendResponse(res, 200, "Device sensor list", queryRes))
                           : this.#sendResponse(res, 404, "Device not exist", {}));
    }
    #_getSensorList(dev, res)
    {
        const dbm = ClientRequestManager.#_dbManager;
        dbm.readSensorList(dev).then( 
            (queryRes) => queryRes ? this.#sendResponse(res, 200, "Device sensor list", queryRes)
            : this.#sendResponse(res, 404, "Device not exist", {}));
    }       
    #_getDevList(res)
    {
        const dbm = ClientRequestManager.#_dbManager;
        dbm.readDevList().then( 
            (queryRes) => this.#sendResponse(res, 200, "Device list", queryRes))
    } 
    #_makeFilter(req)
    {
        if(req.context === true && req.time === true)
            return {sens_id :  ObjectID.createFromHexString(req.arg.sens_id), 
                    measureTime : {$gte : req.arg.from }, measureTime : {$lte : req.arg.to}};
        if(req.context === false && req.time === true)
            return {measureTime : {$gte : req.arg.from }, measureTime : {$lte : req.arg.to}};
        if(req.context === true && req.time === false)
            return {sens_id : ObjectID.createFromHexString(req.arg.sens_id)};
    }
    #_sortTemp(a, b)
    {
        if(a.temp < b.temp) return -1;
        if(a.temp > b.temp) return 1;
        return 0;
    }
    #_sortHum(a, b)
    {
        if(a.hum < b.hum) return -1;
        if(a.hum > b.hum) return 1;
        return 0;
    }
    #_sortLum(a, b)
    {
        if(a.lum < b.lum) return -1;
        if(a.lum > b.lum) return 1;
        return 0;
    }
    #_sortPrTime(a, b)
    {
        if(a.prTime < b.prTime) return -1;
        if(a.prTime > b.prTime) return 1;
        return 0;
    }
    _readStat(req, res)
    {
        const dbm = ClientRequestManager.#_dbManager;
        const filter = this.#_makeFilter(req);
        console.log(req);
        let projection = null;
        switch(req.type)
        {
            case "temp" : 
                projection =  {projection : {_id : 0, temp : 1, sens_id : 1, measureTime : 1}};
                dbm.readStat(filter, projection, "tempHum", req.param, this.#_sortTemp).then( 
                    (queryRes) => queryRes ?
                         this.#sendResponse(res, 200, req.param + " temperature", queryRes)
                            : this.#sendResponse(res, 400, "Statistic not found", {}));
                break;
            case "hum" :
                projection =  {projection : {_id : 0, hum : 1, sens_id : 1, measureTime : 1}};
                dbm.readStat(filter, projection, "tempHum", req.param, this.#_sortHum).then( 
                    (queryRes) => queryRes ?
                         this.#sendResponse(res, 200, req.param + " humidity", queryRes)
                            : this.#sendResponse(res, 400, "Statistic not found", {}));
                break;
            case "lum" :
                projection = {projection : {_id : 0, lu : 1, sens_id : 1, measureTime : 1}};
                dbm.readStat(filter, projection, "luminosity", req.param, this.#_sortLum).then( 
                    (queryRes) => queryRes ?
                         this.#sendResponse(res, 200, req.param + " luminosity", queryRes)
                            : this.#sendResponse(res, 400, "Statistic not found", {}));
                break;
            case "presence" :
                projection = {projection : {_id : 0, prTime: 1, sens_id : 1, measureTime : 1}};
                dbm.readStat(filter, projection, "presence", req.param, this.#_sortPrTime).then( 
                    (queryRes) => queryRes ?
                         this.#sendResponse(res, 200, req.param + " presence", queryRes)
                            : this.#sendResponse(res, 400, "Statistic not found", {}));
                break;
            default : 
                this.#sendResponse(res, 400, "Statistic unknow", {});
        }
    }
    async readStat(req, res)
    {
        const dbm = ClientRequestManager.#_dbManager;
        req.context ? dbm.sensorExist(req.arg.sens_id).then(
            (exist) => exist ? 
                this._readStat(req, res)
                    : this.#sendResponse(res, 400, "Sensor not found", {}))
        : this._readStat(req, res);
    }
    async routReq(req, res)
    {
        switch(req.action)
        {
            case "add" :
                this.addRoutine(req.info, res);
                break;
            case "remove" :
                this.removeRoutine(req.info, res);
                break;
            case "start" :
                this.startRoutine(req.info, res);
                break;
            case "stop" :
                this.stopRoutine(req.info, res);
        }
    }
    async addRoutine(req, res)
    {
        const dbm = ClientRequestManager.#_dbManager;
        let idR = "";
        await dbm.addRoutine(req, "plannedRoutine").then( 
            (id) => 
            {
                idR = id;
                this.#sendResponse(res, 220, "Routine created", JSON.stringify({"_id" : id}));
            });
        return idR;
    }
    async removeRoutine(req, res)
    {
        const dbm = ClientRequestManager.#_dbManager;
        dbm.routineExist(req._id).then(
            (exist) =>  
                exist ? dbm.removeRoutine(req, "plannedRoutine").then(
                        () => this.#sendResponse(res, 223, "Routine removed", JSON.stringify({"_id" : id})))
                    : this.#sendResponse(res, 451, "Routine not exist", JSON.stringify({"_id" : id})));
    }
    startRoutine(req, res)
    {
        const dbm = ClientRequestManager.#_dbManager;
        dbm.routineExist(req._id, "plannedRoutine").then(
            (exist) => 
            {
                if(exist) 
                {
                    dbm.startRoutine(req, "plannedRoutine").then(
                    () =>
                    {    
                        TaskPool.getInstance().then((tp) => tp.startRoutine(req));
                        this.#sendResponse(res, 221, "Routine started", JSON.stringify({"_id" : req._id}));
                    });
                }
                else this.#sendResponse(res, 451, "Routine not exist", JSON.stringify({"_id" : req._id}));
            });
    }
    stopRoutine(req, res)
    {
        const dbm = ClientRequestManager.#_dbManager;
        dbm.routineExist(req._id, "plannedRoutine").then(
             (exist) => 
            {
                if(exist) 
                {
                    dbm.stopRoutine(req, "plannedRoutine");
                    TaskPool.getInstance().then((tp) => tp.stopCRoutine(req));
                    this.#sendResponse(res, 222, "Routine stopped", {});
                }
                else this.#sendResponse(res, 451, "Routine not exist", {});
            });
    }
    manageRequest(url, req, res)
    {
        switch(url)
        {
            case "/sensorList" :
                this.#_getSensorList(JSON.parse(Buffer.concat(req).toString()), res);      
                break;        
            case "/devList" : 
                this.#_getDevList(res);      
                break;        
            case "/tempHum" :
                this.readStat(JSON.parse(Buffer.concat(req).toString()), res);  
                break;
            case "/lum" :
                this.readStat(JSON.parse(Buffer.concat(req).toString()), res);
                break;
            case "/presence" :
                this.readStat(JSON.parse(Buffer.concat(req).toString()), res);
            case "/routine" :
                this.routReq(JSON.parse(Buffer.concat(req).toString()), res);          
        }
    } 
    handler(request, response)
    {
        console.log("new client request...");
        const { method, url} = request;
        console.log(method + " " + url);
        let body = [];
        request.on('error', (errno) => { console.log(errno); })
               .on('data', (item) => { body.push(item); })
               .on('end', () => ClientRequestManager.getInstance().then(
                    (crm) => crm.manageRequest(url, body, response)));
    }
}
class TaskPool
{
    static #_dbManager;
    static #_instance = null;    
    static #_routinePool = [];    
    static async getInstance()
    { 
        if(!TaskPool.#_instance)
        {
            TaskPool.#_instance = new TaskPool() 
            this.#_dbManager =  await DataBaseManager.getInstance();
            await TaskPool.#_instance.#init();
        }
        return TaskPool.#_instance;
    }
    constructor (){}
    async #init()
    {
        console.log("qui");
        const dbm = TaskPool.#_dbManager;
        const devLog = await dbm.readLoggedDevice();
        console.log(devLog);
        for (let dev of devLog)
            await this.startDevRoutine(dev._id);
    }
    async startRoutine(routine)
    {
        console.log("routine -------------------");
        console.log(routine);
        const drd = DevRequestDispatcher.getInstance();
        const tp = await TaskPool.getInstance();
        const drdMethod = await tp.getDevReqDispMethod(routine.op);
        console.log("method -------------------");
        console.log(drdMethod);
        const drdMethodArg = await tp.getDevReqDispArg(routine);
        console.log("drdMethodArg -------------------");
        console.log(drdMethodArg);
        const timeout = setInterval(drdMethod, routine.frequence, drdMethodArg);
        const time = {"_id" : routine._id, "timeout" : timeout};
        const exist = TaskPool.#_routinePool.find(x => x._id == routine._id);
        !exist ? TaskPool.#_routinePool.push(time)
            : console.log("routine already active");
                    console.log("a");
        console.log(TaskPool.#_routinePool[0]._id);
    }
    async stopRoutine(routine)
    {
        const s = TaskPool.#_routinePool.pop(x => x._id == routine._id);
        console.log(s);
        clearInterval(s.timeout);
        console.log(s);
    }
    async devRoutineOp(devID, op)
    {
        const dbm = await DataBaseManager.getInstance();
        const devRoutineList = await dbm.readActiveRoutine("plannedRoutine", devID);
            for (let routine of devRoutineList)
                await op(routine);
    }
    async stopDevRoutine(devID)
    { 
        await this.devRoutineOp(devID, this.stopRoutine);
    }
    async startDevRoutine(devID)
    {
        await this.devRoutineOp(devID, this.startRoutine);
    }
    async getDevReqDispMethod(name)
    {
        const drd =  await DevRequestDispatcher.getInstance();
        switch(name)
        {
            case "readTempHum" :
                return drd.sendTempHumReq;
            case "readLum":
                return drd.sendLumReq;
             case "stillAlive":
                return drd.sendStillAliveReq;
        }
        return null;
    }
    async getDevReqDispArg(routine)
    {
        const dbm = await DataBaseManager.getInstance();
        switch(routine.op)
        {
            case "readTempHum" :
                return routine.sens_id;
            case "readLum":
                return routine.sens_id;
            case "stillAlive":
                return 1;
        }
        return null;
    }
}

class DevRequestManager
{
    static #_dbManager;
    static #_instance = null;        
    static async getInstance()
    { 
        if(!DevRequestManager.#_instance)
        {
            DevRequestManager.#_instance = new DevRequestManager() 
            this.#_dbManager =  await DataBaseManager.getInstance();
        }
        return DevRequestManager.#_instance;
    }
    constructor (){}
    #sendResponse(res, code, msg, body)
    {
        console.log("response " + " msg : " + msg + " code : " + code + " to : ");
        res.statusCode = code;
        res.statusMessage = msg;
        res.setHeader("Content-Length", body.length);
        res.setHeader("Connection", "close");
        res.write(body);
        res.end();
    }
    #_login(req, res)
    { 
        const IP = req.IP[0] + "." + req.IP[1] + "."  + req.IP[2] + "." + req.IP[3];
        DevRequestManager.#_dbManager.login(req._id, IP, req.local_port).then(
            () =>  this.#sendResponse(res, 201, "Login", "")); 
    }
    #_logout(req, res)
    { 
        DevRequestManager.#_dbManager.logout(req).then(
            () => this.#sendResponse(res, 202, "Logout", "")); 
    }
    #addDevice(req, res)
    { 
        const dev = {"_id" : req._id, "mcu" : req.mcu, "board" : req.board, "logged" : false, "serviceTime" : 0};
        DevRequestManager.#_dbManager.addDevice(dev).then(
            () => DevRequestManager.#_dbManager.updateSensorList(req.list, req._id).then(
                () => DevRequestManager.#_dbManager.readSensID(req, "all").then(
                    (idList) => this.#sendResponse(res, 200, "Device registered", JSON.stringify(idList)))));
    }
    #register(dev, res)
    {
        const dbm = DevRequestManager.#_dbManager;
        dbm.devExist(dev._id).then(
            exist => !exist ?
                this.#addDevice(dev, res)
                    :  dbm.readSensID(dev, "all").then(
                        (idList) =>
                            this.#sendResponse(res, 403, "", JSON.stringify(idList))));
    }
    #login(dev, res)
    { 
        const dbm = DevRequestManager.#_dbManager;
        dbm.devExist(dev._id).then(
            exist => exist ? dbm.devLogged(dev._id).then( 
                login => login ?
                    this.#sendResponse(res, 405, "Already logged", "")
                        : this.#_login(dev, res))
               : this.#sendResponse(res, 404, "Not exist.", ""));
    } 
    #presence(sensor, res)
    {
        console.log("adv rec");
        this.#sendResponse(res, 203, "Adv rec", "");
        const dbm = DevRequestManager.#_dbManager;
        dbm.postNewStat("presence", {"sens_id" : sensor.sens_id}).then(
            (statID) =>  
            {
                const drd = DevRequestDispatcher.getInstance();
                setTimeout(drd.sendPresenceReq, 1000, sensor.sens_id, statID);
            });
    }
    manageRequest(url, dev, res)
    {
        switch(url)
        {
            case "/login" : // login request
                this.#login(JSON.parse(Buffer.concat(dev).toString()), res); 
                break;        
            case "/reg" : // registration request
                this.#register(JSON.parse(Buffer.concat(dev).toString()), res);
                break;
            case "/pr" : 
                this.#presence(JSON.parse(Buffer.concat(dev).toString()), res);
        }
    }
    handler(request, response)
    {
        console.log("new request...");
        const { method, url} = request;
        console.log(method + " " + url);
        let body = [];
        request.on('error', (errno) => { console.log(errno); })
               .on('data', (item) => { body.push(item); })
               .on('end', () => DevRequestManager.getInstance().then(
                        (drm) => 
                        {
                            drm.manageRequest(url, body, response);
                        }));
    }
}
class DevRequestDispatcher
{
    static #_instance;
    static getInstance()
    { 
        return !DevRequestDispatcher.#_instance ?
            DevRequestDispatcher.#_instance = new DevRequestDispatcher() 
                : DevRequestDispatcher.#_instance;
    }
    constructor (){}
    updatePrTime(id, mTime)
    {
        const time = new Date().getSeconds() - new Date(mTime).getSeconds();
        console.log("T----");
        console.log(time);
        const setter = {$set : {prTime : time}}
        DataBaseManager.getInstance().then(
            (dbm) => dbm.updateStat(id, "presence", setter));
    }
    checkIfPrEnd(sensorID, statID, body)
    {   
        console.log("check");
        console.log(sensorID);
        console.log(statID);
        let prInfo = JSON.parse(Buffer.concat(body).toString());
        DataBaseManager.getInstance().then(
            (dbm) =>
                prInfo.stillHigh ?
                    setTimeout(this.sendPresenceReq, 1000, sensorID, statID)
                        : dbm.readStatMsrTime("presence", statID).then(
                            (mTime) => this.updatePrTime(statID, mTime)));
    }
    devIsAlive(dev)
    {
        DataBaseManager.getInstance().then(
        (dbm) =>
        {
            const IP = dev.IP[0] + "." + dev.IP[1] + "."  + dev.IP[2] + "." + dev.IP[3];
            dbm.alive(dev._id, IP, dev.local_port);
        });
    }
    manageStatRes(res, db, coll)
    {
        let body = [];
        res.on('error', (errno) => { console.log(errno); })
           .on('data', (item) => { body.push(item); })
           .on('end',() => db.postNewStat(coll, JSON.parse(Buffer.concat(body).toString())).then((id) => console.log(id)))
    }
    manageAliveRes(res, devID)
    {
        let body = [];
        res.on('data', (item) => { body.push(item); })
           .on('end',() => DevRequestDispatcher.getInstance().devIsAlive(JSON.parse(Buffer.concat(body).toString())))
    }
    managePrRes(res, sensorID, statID)
    {
        let body = [];
        res.on('error', (errno) => { console.log(errno); })
           .on('data', (item) => { body.push(item); })
           .on('end',() => DevRequestDispatcher.getInstance().checkIfPrEnd(sensorID, statID, body));
    }
    async buildDevReq(devID, callback, method, path)
    {
        const db = await DataBaseManager.getInstance();
        const ip = await db.readLastIP(devID);
        const port = await db.readLastPort(devID);
        const option = {'method': method, 'path': path, 'host': ip , 'port': port, 'protocol' : "http:"};
        const request = http.request(option, callback);
        return request;   
    }
    async sendStillAliveReq(devID)
    {
        const db = await DataBaseManager.getInstance();
        const drd = await DevRequestDispatcher.getInstance();
        const callback = (res) => drd.manageAliveRes(res, devID);
        const request = await drd.buildDevReq(devID, callback, "GET", "/alive");
     //   request.on('error', (errno) => db.devLogged(devID).then((log) => log ? await db.logout(devID) : console.log("Already logout.")));
        request.end();   
    }
    async sendTempHumReq(sensorID)
    {
        const db = await DataBaseManager.getInstance();
        const drd = await DevRequestDispatcher.getInstance();
        const callback = (res) => drd.manageStatRes(res, db, "tempHum");
        const devID = await db.readDevOfSens(sensorID);
        const request = await drd.buildDevReq(devID, callback, "GET", "/th");
     //   request.on('error', (errno) => db.devLogged(devID).then((log) => log ? await db.logout(devID) : console.log("Already logout.")));
        request.end();     
    }
    async sendLumReq(sensorID)
    {
        const db = await DataBaseManager.getInstance();
        const drd = await DevRequestDispatcher.getInstance();
        const callback = (res) => drd.manageStatRes(res, db, "luminosity");
        const devID = await db.readDevOfSens(sensorID);
        const request = await drd.buildDevReq(devID, callback, "GET", "/lm");
   //     request.on('error', (errno) => db.devLogged(devID).then((log) => log ? await db.logout(devID) : console.log("Already logout.")));
        request.end();     
    }
    async sendPresenceReq(sensorID, statID)
    {
        const drd = await DevRequestDispatcher.getInstance();
        const db = await DataBaseManager.getInstance();
        const callback = (res) => DevRequestDispatcher.getInstance().managePrRes(res, sensorID, statID);
        const devID = await db.readDevOfSens(sensorID);
        const request = await drd.buildDevReq(devID, callback, "GET", "/pr");
     //   request.on('error', (errno) => db.devLogged(devID).then((log) => log ? await db.logout(devID) : console.log("Already logout.")));
        request.end();     
    }
}

class SensHubServer
{
    #_clientServer;
    #_devServer;
    static #_instance;
    static async getInstance()
    { 
        if(!SensHubServer.#_instance)
        {
            SensHubServer.#_instance = new SensHubServer() 
            await this.#_instance.#_init();
        }
        return SensHubServer.#_instance;
    }
    constructor (){}
    async #_init()
    {
        const dbm = await DataBaseManager.getInstance();
        const crm = await ClientRequestManager.getInstance();
        const drm = await DevRequestManager.getInstance();
        const drd = await DevRequestDispatcher.getInstance();
        const tp = await TaskPool.getInstance();
        this.#_clientServer = http.createServer(crm.handler);
        this.#_devServer= http.createServer(drm.handler);
        this.listen();
    }
    listen()
    {
        this.#_clientServer.listen(800);
        this.#_devServer.listen(80);
        console.log("waiting for request...");
    }
};

const server = SensHubServer.getInstance(); //.then((server) => server.listen());

             