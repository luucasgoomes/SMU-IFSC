'use strict';

/*
* @author Mathias
*/

console.log('----------------Servidor Orquestra---------------');

/*------------------------------Módulos--------------------------------*/

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');
var cors = require('cors');
var ip = require('ip');

/*------------------------------Variáveis------------------------------*/

var roomList = [];
var clientsList = [];
var numClients;

/*------------------------------Index.html----------------------------*/

var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
});

app.on('listening',function(){
    console.log('ok, server is running');
});

app.listen(56890,ip.address());

/*--------------------------Arquivos de Áudio-------------------------*/

var express = require('express')
var app2 = express()
app2.listen(3000,ip.address(), function () {
  console.log('INFO: Arquivos Ok!');
})
app2.use(express.static('public'),cors)

console.log('INFO: IP de serviço - ' + ip.address());
/*-------------------------------Conexão-----------------------------*/

var io = socketIO.listen(app);

io.sockets.on('connection', function(socket) {

// Mensagens utilizadas para sinalização entre Iniciador e Peers. 

    socket.on('message', function(data) {

        var message = data.payload;
        var roomID = data.roomID;
        var room = foundRoom(roomID);

        if(socket === room.getClientsList()[0]){
            console.log('INFO: Messagem Iniciador -> Peer');
            // Se eu sou o iniciador, eu estou enviando mensagens com o ultimo peer;
            room.getClientsList()[room.getNumClients() - 1].emit('message',message);            
        }else{
            console.log('INFO: Mensagem Peer -> Iniciador');
            // Se eu sou o peer, eu estou enviado mensagens com o iniciador;
            room.getClientsList()[0].emit('message',message);            
        }
    });

// Mensagem para criação de sala ou login.

    socket.on('create or join', function(roomID) {

        var room = foundRoom(roomID);

        if(room !== null){
            // A sala ainda não foi criada, é necessário criar é adicionar o criador (iniciador) à lista.
            console.log('INFO: Esta sala já foi criada!');
            room.clientsListPush(socket);
            room.nClientsIncrement();
        }else{
            // A sala ja foi criada, é necessário apenas adicionar o peer à lista.
            console.log('INFO: Criando a sala: ' + roomID);
            room = new Room(roomID);
            roomList.push(room);
            room.clientsListPush(socket);
            room.nClientsIncrement();
        }
    
        console.log('INFO: Sala ' + room.getRoomID() + ' possui agora ' + room.getNumClients() + ' cliente(s)');

        if (room.getNumClients() === 1) {
            // Eu sou o Iniciador!
            room.getClientsList()[0].join(room.getRoomID());
            room.getClientsList()[0].emit('created', roomID, room.getClientsList()[0].id);
        }else if(room.getNumClients() <= 5) {
            // Eu sou um Peer!
            room.getClientsList()[room.getNumClients() - 1].join(room.getRoomID());
            console.log('INFO: Cliente ' + socket.id + ' entrou na sala: ' + room.getRoomID());
            room.getClientsList()[room.getNumClients() - 1].emit('joined', room.getRoomID(), socket.id, ip.address());
            room.getClientsList()[0].emit('ready', roomID); 
        } else { 
            room.getClientsList()[room.getNumClients() - 1].emit('full', room.getRoomID());
        }
    });

// Mensagem para atualização do IP do servidor.

    socket.on('ipaddr', function() {
        socket.emit('ipaddr',ip.address());
    });

// Mensagem para remover peer da sala ou fechar a sala.

    socket.on('bye', function(){
        console.log('received bye');
    });

});

/*---------------------------Funções e Objetos-----------------------------*/

/*
Objeto Room:
- Responsável por armazernar a lista de clientes 
*/
var Room = function(id){

    this.id = id;
    this.clientsList = [];
    this.nClients = 0;

    this.getRoomID = function(){
        return this.id;
    }

    this.getClientsList = function(){
        return this.clientsList;
    }

    this.getNumClients = function(){
        return this.nClients;
    }
 
    this.clientsListPush = function(client){
        this.clientsList.push(client);
    }

    this.nClientsIncrement = function(){
       this.nClients++;
    }
};

/*
Retorna se a sala já existe ou não.
*/
function foundRoom(roomID){

    if(roomList.length > 0){
        for(var i = 0; i < roomList.length; i++){
            if(roomList[i].getRoomID() === roomID){
                return roomList[i];
            }
        }
    }    
    return null;
}

