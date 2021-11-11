#include <EthernetWebServer_STM32.h>
#include <EthernetHttpClient_STM32.h>
#include <Dhcp.h>
#include "ArduinoJson-v6.18.5.h"
#include <DHT.h>
#include <string.h>

#define SENSOR_NUM 3
#define SENS_ID_SIZE 30
#define BUFF_SIZE 1000
#define DHT_11_PIN 2
#define HC_SR_501_PIN 9
#define DHT_TYPE DHT11
#define DEV_ID 1
#define POST "POST"
#define GET "GET"
#define REG_URL "/reg"
#define LOGIN_URL "/login"
#define LOGOUT_URL "/logout"
#define PR_URL "/pr"
#define TH_URL "/tH"
#define LM_URL "/lm"
#define AL_URL "/alive"
#define VERSION "HTTP/1.1"
#define CONT_HEAD "Content-Type: application/json"
#define R_JSON_SIZE  JSON_OBJECT_SIZE(1) * 3 + JSON_ARRAY_SIZE(SENSOR_NUM) + JSON_OBJECT_SIZE(2) + JSON_OBJECT_SIZE(1) * SENSOR_NUM + (JSON_OBJECT_SIZE(1) * 3) * SENSOR_NUM 
#define L_JSON_SIZE  JSON_OBJECT_SIZE(1) * 3 + JSON_ARRAY_SIZE(4)
#define LO_JSON_SIZE JSON_OBJECT_SIZE(1)
#define TH_JSON_SIZE JSON_OBJECT_SIZE(1) * 3 + JSON_ARRAY_SIZE(SENS_ID_SIZE)
#define PR_JSON_SIZE JSON_OBJECT_SIZE(1) * 2 + JSON_ARRAY_SIZE(SENS_ID_SIZE)
#define PR_ADV_JSON_SIZE JSON_OBJECT_SIZE(1) * 1 + JSON_ARRAY_SIZE(SENS_ID_SIZE)
#define LM_JSON_SIZE JSON_OBJECT_SIZE(1) * 2  + JSON_ARRAY_SIZE(SENS_ID_SIZE)
#define S_ID_JSON_SIZE JSON_ARRAY_SIZE(SENSOR_NUM) + JSON_OBJECT_SIZE(2) + JSON_OBJECT_SIZE(1) * SENSOR_NUM + (JSON_OBJECT_SIZE(1) * 3) * SENSOR_NUM

/*#define TH_RES "TH m"
#define LM_RES "Lm m"
#define SL_RES "SL"
#define PR_RES "P adv"
#define SENS_ID_RES "SID rec"*/

/********************************************************************************************/

typedef enum SERVER_DEVICE_REQUEST_TYPE
{
    BAD_REQUEST = 0,
    TH_INFO,     // GET /tempHum               fetch temp and hum.
    LM_INFO,     // GET /luminosisty           fetch the luminisity.
    PR_INFO,     // GET
    AL_INFO
}
sd_req;

typedef enum DEVICE_SERVER_REQUEST_TYPE
{
    REG,        // POST  /Registration request. 
    LOGIN,      // POST  /Login request. 
    LOGOUT,     // POST  /Login request. 
    PR_ADVICE   //POST
}
ds_req; //WRITE

/********************************************************************************************/

typedef enum SERVER_DEVICE_RESPONCE_TYPE                    //READ
{  
    BAD_RESPONSE_CODE = -1,
    REG_DEN_CODE = 400,
    DEV_NOT_EXS_CODE = 404,
    DEV_ALR_REG_CODE = 403,
    DEV_ALR_LOG_CODE = 405,
    REG_ACK_CODE = 200,     // 
    LOGIN_ACK_CODE = 201,
    LOGOUT_ACK_CODE = 202,
    PR_ADV_ACK_CODE = 203,
    SA_ACK_CODE = 204
}
sd_res;

typedef enum DEVICE_SERVER_RESPONCE_TYPE
{
    WRONG = 0,
    TH_UPLOAD = 211,     
    LM_UPLOAD = 212,     
    PR_UPLOAD = 213,
    AL_ACK = 214
} 
ds_res;

typedef enum SENSOR_MODEL
{
    DHT_11_MODEL = 0,
    HC_SR_501_MODEL = 1,
    RES_MODEL = 2
}s_model;

typedef enum SENSOR_TYPE
{
    TH_TYPE = 0,
    PIR_TYPE = 1,
    LUM_TYPE = 2
}s_type;

/********************************************************************************************/

uint8_t validate_method(char *ptr)
{
    if(strcmp(ptr,  POST) == 0)
        return 1;
    if(strcmp(ptr,  GET) == 0)
        return 2;
    return 0;
}

uint8_t validate_url(char *ptr)
{
    if(strcmp(ptr, TH_URL) == 0)
        return 1;
    if(strcmp(ptr, LM_URL) == 0)
        return 2;                    
    if(strcmp(ptr, PR_URL) == 0)
        return 3;  
    if(strcmp(ptr, AL_URL) == 0)
        return 4;       
    return 0;
}

uint8_t validate_ver(char *ptr)
{
    if(strcmp(ptr, VERSION) == 0)
        return 1;
    return 0;
}

sd_req validate_req_line(char *line)
{
    uint8_t method = validate_method(strtok(line," "));
    uint8_t url = validate_url(strtok(NULL, " "));
    uint8_t ver = validate_ver(strtok(NULL," "));
  //  if(!ver) return BAD_REQUEST;
    if(method == 2 && url == 1)
          return TH_INFO;
    if(method == 2 && url == 2)
        return LM_INFO; 
    if(method == 2 && url == 3)
        return PR_INFO;
    if(method == 2 && url == 4)
        return AL_INFO;
    return BAD_REQUEST;
}

sd_res validate_res_line(char *line, char *msg)
{
    uint8_t ver = validate_ver(strtok(line," "));
    sd_res res = (sd_res) atoi(strtok(NULL," "));
    strcpy(msg, strtok(NULL," "));
    return res;
}

void read_body(char *body, char *json)
{

}

typedef struct SENSOR_INFO
{
    s_model model;
    s_type type; 
    char sens_id[SENS_ID_SIZE];
}s_info;

class JsonFactory
{
    public:
        JsonFactory(){}
        void build_JSON_R(StaticJsonDocument<R_JSON_SIZE> *doc, s_info *s_i);
        void build_JSON_L(StaticJsonDocument<L_JSON_SIZE> *doc, uint16_t local_port);
        void build_JSON_LO(StaticJsonDocument<LO_JSON_SIZE> *doc);
        void build_JSON_TH(StaticJsonDocument<TH_JSON_SIZE> *doc, float *temp, float *hum, char *sens_id);
        void build_JSON_PR(StaticJsonDocument<PR_JSON_SIZE> *doc, bool still_high, char *sens_id);
        void build_JSON_PR_ADV(StaticJsonDocument<PR_ADV_JSON_SIZE> *doc, char *sens_id);
        void build_JSON_LM(StaticJsonDocument<LM_JSON_SIZE> *doc, char *sens_id);    
};

void JsonFactory :: build_JSON_R(StaticJsonDocument<R_JSON_SIZE> *doc, s_info *s_i)
{
    (*doc)["_id"] = DEV_ID;
    (*doc)["mcu"] = "STM32F401RE";
    (*doc)["board"] = "NUCLEO";
    for (uint8_t i = 0; i < SENSOR_NUM ; i++)
    {
        (*doc)["list"][i]["model"] = (s_i + i)->model;
        (*doc)["list"][i]["type"] = (s_i + i)->type;
        (*doc)["list"][i]["s_num"] = i;
    }
}

void JsonFactory :: build_JSON_L(StaticJsonDocument<L_JSON_SIZE> *doc, uint16_t local_port)
{
    (*doc)["_id"] = DEV_ID;
    (*doc)["local_port"] = local_port;
    (*doc)["IP"][0] = Ethernet.localIP()[0];
    (*doc)["IP"][1] = Ethernet.localIP()[1];
    (*doc)["IP"][2] = Ethernet.localIP()[2];
    (*doc)["IP"][3] = Ethernet.localIP()[3];
}

void JsonFactory :: build_JSON_LO(StaticJsonDocument<LO_JSON_SIZE> *doc) // 1
{
    (*doc)["_id"] = DEV_ID;
}

void JsonFactory :: build_JSON_PR(StaticJsonDocument<PR_JSON_SIZE> *doc, bool still_high, char *sens_id)
{
    (*doc)["sens_id"] = String(sens_id);
    (*doc)["stillHigh"] = still_high;
}

void JsonFactory :: build_JSON_PR_ADV(StaticJsonDocument<PR_ADV_JSON_SIZE> *doc, char *sens_id)
{
    (*doc)["sens_id"] = String(sens_id);
}

void JsonFactory :: build_JSON_TH(StaticJsonDocument<TH_JSON_SIZE> *doc, float *temp, float *hum, char *sens_id)
{
    (*doc)["sens_id"] = String(sens_id);
    (*doc)["temp"] = *temp;
    (*doc)["hum"] = *hum;
}

void JsonFactory :: build_JSON_LM(StaticJsonDocument<LM_JSON_SIZE> *doc, char *sens_id)
{
    (*doc)["sens_id"] = String(sens_id);
    (*doc)["lum"] = analogRead(A0);
}

class ServDispatcher
{
        EthernetClient remoteServer;
        EthernetServer *server; 
        JsonFactory *factory;
        char * buff;
        char *json;
        uint8_t read();
        void write_msg_stat_line(ds_res res,char *stat_line);
        void write_header(const char * const type, const int len);
        
    public: 
        
        ServDispatcher(JsonFactory *factory, EthernetServer *server, char *buff, char *json);
        void send_th_res(DHT *dht, char *sens_id);
        void send_lm_res(char *sens_id);
        void send_pr_res(char *sens_id);
        void send_a_res(uint16_t local_port);
        void send_s_id_res();
        uint8_t read_sens_id(s_info *sens_id);
        void read_json();
        sd_req rcv_HTTP_req();
        void reg_sens_list(s_info *s_i);
        bool visto = false;
        unsigned long int b;
        bool pause = false;
};

ServDispatcher :: ServDispatcher(JsonFactory *factory, EthernetServer *server, char *buff, char *json)
{
    this->factory = factory;
    this->server = server;   
    this->buff = buff;   
    this->server->begin(); 
    this->visto = false;
    this->json = json;
}

uint8_t ServDispatcher :: read()
{        
    uint8_t byte_count = 0;
    memset(buff, 0, sizeof(char) * BUFF_SIZE);
    while(!remoteServer.available()){}
    while(remoteServer.available())
    {
        * (buff + byte_count) = remoteServer.read();
        byte_count++;
    }
    return byte_count;
}

sd_req ServDispatcher :: rcv_HTTP_req()
{
  if((remoteServer  = server->accept()))
    {
        if(remoteServer.connected())
        {
            Serial.print("New req -> ");
            Serial.print(this->read());
            Serial.print(" byte, type : ");
            sd_req type = validate_req_line(buff);
            Serial.println(type);
            read_body(buff, json);
            Serial.println(json);
            return type;
        }
    }
    return BAD_REQUEST; 
}

void ServDispatcher :: write_msg_stat_line(ds_res res, char *stat_line)
{
    remoteServer.print(VERSION);
    remoteServer.print(" ");
    remoteServer.print(res);
    remoteServer.print(" ");
    remoteServer.println(stat_line);
}

void ServDispatcher :: write_header(const char * const type, const int len)
{
    remoteServer.println(type);
    remoteServer.println("Connection: close");
    remoteServer.print("Content-Length:");
    remoteServer.println(len);
    remoteServer.println();
}

void ServDispatcher :: send_lm_res(char *sens_id)
{
    StaticJsonDocument<LM_JSON_SIZE> doc;
    factory->build_JSON_LM(&doc, sens_id);
    write_msg_stat_line(LM_UPLOAD, "");
    write_header(CONT_HEAD, measureJson(doc));
    serializeJson(doc, remoteServer);
    remoteServer.stop();   ///////////////////////////////////
}

void ServDispatcher :: send_pr_res(char *sens_id)
{
    StaticJsonDocument<PR_JSON_SIZE> doc;
    if(visto && ((millis() - b) > 8000))
    {
        visto = digitalRead(HC_SR_501_PIN);
        digitalWrite(7, visto);
        factory->build_JSON_PR(&doc, visto, sens_id);
    }else factory->build_JSON_PR(&doc, true, sens_id);
    write_msg_stat_line(PR_UPLOAD, "");
    write_header(CONT_HEAD, measureJson(doc));
    serializeJson(doc, remoteServer);
    remoteServer.stop();   ///////////////////////////////////
}

void ServDispatcher :: send_a_res(uint16_t local_port)
{
    StaticJsonDocument<L_JSON_SIZE> doc;
    factory->build_JSON_L(&doc, local_port);
    write_msg_stat_line(AL_ACK, "");
    write_header(CONT_HEAD, measureJson(doc));
    serializeJson(doc, remoteServer);
    remoteServer.stop();   ///////////////////////////////////
}

void ServDispatcher :: send_th_res(DHT *dht, char *sens_id)
{
    StaticJsonDocument<TH_JSON_SIZE> doc;
    float temp = dht->readTemperature(), hum = dht->readHumidity();  
    factory->build_JSON_TH(&doc, &temp, &hum, sens_id);
    write_msg_stat_line(TH_UPLOAD, "");
    write_header(CONT_HEAD, measureJson(doc));
    serializeJson(doc, remoteServer);
    remoteServer.stop();   ///////////////////////////////////
}

class DevDispatcher
{
        EthernetClient client; 
        JsonFactory *factory;
        IPAddress *server_addr;
        uint16_t remote_port;
        uint16_t local_port;
        bool logged = false;
        bool registered = false;
        char *buff;
        char *json;
        
        void write_req_line(const char * const method, const char * const uri, const char * const prot);
        void write_header(const char * const type, const uint8_t len);
        uint8_t read();
        void send_reg_req(s_info *s);
        void send_login_req();
        void send_logout_req();
        void send_pr_req(char *sens_id);

    public: 
        
        DevDispatcher(JsonFactory *factory, IPAddress *server_addr, uint16_t remote_port, uint16_t local_port, char *buff, char *json);
        sd_res rcv_HTTP_res();
        sd_res registration(s_info *s);
        sd_res login();
        void advice(char *sens_id);
        bool rec_sens_id_l(s_info *sens_id);
        uint16_t get_local_port();
        
};

DevDispatcher :: DevDispatcher(JsonFactory *factory, IPAddress *server_addr, uint16_t remote_port, uint16_t local_port, char *buff, char *json)
{
    this->server_addr = server_addr;
    this->factory = factory; 
    this->local_port = local_port;  
    this->remote_port = remote_port;  
    this->buff = buff;    
    this->json = json;
}

uint16_t DevDispatcher :: get_local_port(){ return this->local_port;}

void DevDispatcher :: write_req_line(const char * const method, const char * const uri, const char * const prot)
{
    client.print(method);
    client.print(" ");
    client.print(uri);
    client.print(" ");
    client.println(prot);
}

void DevDispatcher :: write_header(const char * const type, const uint8_t len)
{
    client.println(type);
    client.println("Connection: close");
    client.print("Content-Length:");
    client.println(len);
    client.println();
}

void DevDispatcher :: send_reg_req(s_info *s)
{
    StaticJsonDocument<R_JSON_SIZE> doc;
    factory->build_JSON_R(&doc, s);
    write_req_line(POST, REG_URL, VERSION);
    write_header(CONT_HEAD, measureJson(doc));
    serializeJson(doc, client);
}

void DevDispatcher :: send_login_req()
{
    StaticJsonDocument<L_JSON_SIZE> doc;
    factory->build_JSON_L(&doc, this->local_port);
    write_req_line(POST, LOGIN_URL, VERSION);
    write_header("Content-Type: application/json", measureJson(doc));
    serializeJson(doc, client);
}

void DevDispatcher :: send_logout_req()
{
    StaticJsonDocument<LO_JSON_SIZE> doc;
    factory->build_JSON_LO(&doc);
    write_req_line(POST, LOGOUT_URL, VERSION);
    write_header("Content-Type: application/json", measureJson(doc));
    serializeJson(doc, client);
}

void DevDispatcher :: send_pr_req(char *sens_id)
{
    StaticJsonDocument<PR_ADV_JSON_SIZE> doc;
    factory->build_JSON_PR_ADV(&doc, sens_id);
    write_req_line(POST, PR_URL, VERSION);  
    write_header("Content-Type: application/json", measureJson(doc));
    serializeJson(doc, client);
}

uint8_t DevDispatcher :: read()
{             
    uint8_t byte_count = 0;
    memset(buff, 0, sizeof(char) * BUFF_SIZE);
    while(!client.available()){}
    while(client.available() && byte_count < BUFF_SIZE)
    {
        *(buff + byte_count) =  client.read();
        byte_count++;
    }
    return byte_count;
}

sd_res DevDispatcher :: rcv_HTTP_res()
{ 
    char msg[100];
    this->read();   
    char line[100];
    strncpy(line, buff, 100);
    line[99] = '\0';
    Serial.println(line);
    sd_res res = validate_res_line(line, msg);
    char *ptr = strtok (buff, "\n");    
    for(uint8_t  i = 0; i < 5; i++ )
        ptr = strtok (NULL, "\n");
    Serial.println(ptr);
    strncpy(json, ptr, strlen(ptr));
       Serial.println("RB-------------------------");
    Serial.println(json);
    client.stop();    
    return res;
}

sd_res DevDispatcher :: registration(s_info *s)
{
    while(!client.connect(*server_addr, remote_port)){}
    send_reg_req(s);
    switch(rcv_HTTP_res())
    {
        case DEV_ALR_REG_CODE :
            Serial.println("Device already registered");
            return DEV_ALR_REG_CODE;
        case REG_ACK_CODE :
            Serial.println("Device registered");
            return REG_ACK_CODE;
        default :
            return BAD_RESPONSE_CODE;
   }
}

sd_res DevDispatcher :: login()
{
   while(!client.connect(*server_addr, remote_port)){}
   send_login_req();
   switch(rcv_HTTP_res())
   {
        case LOGIN_ACK_CODE :
            Serial.println("Device logged.");
            return LOGIN_ACK_CODE;
        case DEV_ALR_LOG_CODE :
            Serial.println("Device already logged.");
            return DEV_ALR_LOG_CODE;
        case DEV_NOT_EXS_CODE :
            Serial.println("Device not exist.");
            return DEV_NOT_EXS_CODE;
        default :
            Serial.println("Bad response.");
            return BAD_RESPONSE_CODE;
   }
}

void DevDispatcher :: advice(char *sens_id)
{
    if(client.connect(*server_addr, remote_port))
    {
        send_pr_req(sens_id);
        Serial.println(rcv_HTTP_res());    
    }
}

bool DevDispatcher :: rec_sens_id_l(s_info *sens_id)
{
    StaticJsonDocument<S_ID_JSON_SIZE> doc;
    deserializeJson(doc, json) ;
    for(int i = 0; i < SENSOR_NUM; i++)
    {
        uint8_t sens_num = doc[i]["sens_num"].as<uint8_t>();
        strcpy((sens_id + i)->sens_id , doc[i]["_id"].as<const char *>());
        Serial.println((sens_id + i)->sens_id);
    } 
    return true;
    Serial.println("OK");
}

class SensorHub
{
        uint16_t dev_id;
        uint8_t *mac;
        IPAddress *local_addr;
        IPAddress *myDns;
        bool data_available;    
        ServDispatcher *sd;
        DevDispatcher *dd;
        DHT *dht11;
        char *buff;
        s_info *s_i; 
        void init_connection(IPAddress *local_addr);
        void init_ethernet();
        
    public:
    
        SensorHub(uint16_t dev_id, uint8_t *mac, ServDispatcher *sd, DevDispatcher *dd, DHT *dht11, s_info *s_i, char *buff);
        SensorHub(uint16_t dev_id, uint8_t *mac, IPAddress *local_addr, ServDispatcher *sd, DevDispatcher *dd, DHT *dht11, s_info *s_i, char *buff);
        void init_connection();
        void init();
        void routine();
        void set_sens_id();
        void init_sens_info();
};

SensorHub :: SensorHub(uint16_t dev_id, uint8_t *mac, ServDispatcher *sd, DevDispatcher *dd, DHT *dht11, s_info *s_i, char *buff)
{
    this->dev_id = dev_id;
    this->mac = mac;
    this->dht11 = dht11; 
    this->local_addr = NULL; 
    this-> sd = sd;
    this-> dd = dd;
    this->s_i = s_i;
    this->buff = buff;
}

SensorHub :: SensorHub(uint16_t dev_id, uint8_t *mac, IPAddress *local_addr, ServDispatcher *sd, DevDispatcher *dd, DHT *dht11, s_info *s_i, char *buff)
{
    this->dev_id = dev_id;
    this->mac = mac;
    this->dht11 = dht11;  
    this->local_addr = local_addr;
    this-> sd = sd;
    this-> dd = dd;
    this->s_i = s_i;
    this->buff = buff;
}

void SensorHub :: init_ethernet()
{
    if(Ethernet.hardwareStatus() == EthernetNoHardware) 
        Serial.println("Ethernet shield was not found.");
    else Serial.println("Ethernet shield found.");
    if(Ethernet.linkStatus() == LinkOFF) 
        Serial.println("Ethernet cable is not connected.");
    else Serial.println("Ethernet cable found.");
}

void SensorHub :: init_connection()
{
    Serial.println("Initialize Ethernet with DHCP:");
    if(!Ethernet.begin(mac))
        Serial.println("Failed to configure Ethernet using DHCP");
    else
    { 
        Serial.print("IP : ");
        Serial.println(Ethernet.localIP());  
    }
    init_ethernet();
}

void SensorHub :: init_connection(IPAddress *local_addr)
{
    Serial.println("Initialize Ethernet with static ip.");
    Ethernet.begin(mac, *local_addr); 
    Serial.print("IP : ");
    Serial.println(Ethernet.localIP());  
    init_ethernet();    
}

void SensorHub :: init_sens_info()
{
    s_i->model = DHT_11_MODEL;
    (s_i + 1)->model = HC_SR_501_MODEL;
    (s_i + 2)->model = RES_MODEL;
    (s_i)->type = TH_TYPE;
    (s_i + 1)->type = PIR_TYPE;
    (s_i + 2)->type = LUM_TYPE;
}

void SensorHub :: init()
{
    delay(2000);
    init_connection();
    init_sens_info();
    dd->registration(s_i);
    dd->rec_sens_id_l(s_i);
    Serial.println("Registration compleate. ");
    dd->login();
    Serial.println("Login. ");
}     

bool a = false, reg = false;
uint8_t q = 0;
void SensorHub :: routine()
{
    switch(sd->rcv_HTTP_req())
    {
        case AL_INFO :
            sd->send_a_res(dd->get_local_port());
            break;
        case TH_INFO :
            sd->send_th_res(dht11, (s_i)->sens_id);
            break;
        case LM_INFO :
            sd->send_lm_res((s_i + 1)->sens_id);
            break;
        case PR_INFO :
            sd->send_pr_res((s_i + 2)->sens_id);
            break;
       
    }        
}

uint8_t mac[] = {0x0, 0x16, 0x67, 0x1, 0x9B, 0x3C}; 
IPAddress remote_addr(192, 168, 1, 85);
DHT dht(DHT_11_PIN, DHT_TYPE);
EthernetServer s(3000);
JsonFactory f;
char buff[BUFF_SIZE];
char json[1000];
s_info s_i[SENSOR_NUM];
DevDispatcher dd(&f, &remote_addr, 80, 3000, buff, json);
ServDispatcher sd(&f, &s, buff, json);
SensorHub sensorhub(1, mac, &sd, &dd, &dht, s_i, buff);

void setup() 
{
    Serial.begin(115200);
    dht.begin();
    sensorhub.init();
    pinMode(9,INPUT);
    pinMode(7,OUTPUT);
    delay(1000);
}

unsigned long int seconds = 0;
void loop() 
{ 
    sensorhub.routine();
    if(digitalRead(6) && !sd.visto)
    {
        sd.b = millis();
        dd.advice(s_i[1].sens_id);
        sd.visto = true;
        digitalWrite(7,HIGH);
    }
}