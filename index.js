'use strict';

console.log('----------------Servidor Orquestra---------------');

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');

var roomList = [];
var clientsList = [];
var numClients

var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(8080,'191.36.10.9');

var express = require('express')
var app2 = express()
app2.listen(3000,'191.36.10.9', function () {
  console.log('INFO: Arquivos disponibilizados através da porta: 3000!');
})
app2.use(express.static('public'))

var io = socketIO.listen(app);

io.sockets.on('connection', function(socket) {

    socket.on('message', function(message) {
        if(socket == clientsList[0]){
            console.log('INFO: Messagem Iniciador -> Peer');
            // Se eu sou o iniciador, eu estou enviando mensagens com o ultimo peer;
            clientsList[numClients-1].emit('message',message);            
        }else{
            console.log('INFO: Mensagem Peer -> Iniciador');
            // Se eu sou o peer, eu estou enviado mensagens com o iniciador;
            clientsList[0].emit('message',message);            
        }
    });

    socket.on('create or join', function(roomID) {

        //TODO:
        // Se a sala ainda não foi criada:
        // --> Criar sala
        // --> Adicionar a lista de sala
        // Se a sala ja foi criada
        // --> Buscar referencia da sala com o roomID
        //
        // var room = {
        //    id: roomID ,
        //    clients: clientsList
        // } 

        console.log('INFO: Recebido requisição para criar ou entrar na sala: ' + roomID);

        clientsList.push(socket);   
        numClients = io.sockets.sockets.length;
    
        console.log('INFO: Sala ' + roomID + ' possui agora ' + numClients + ' cliente(s)');

        if (numClients === 1) {
            clientsList[0].join(roomID);
            clientsList[0].emit('created', roomID, clientsList[0].id);
        }else if(numClients <= 5) {
            clientsList[numClients-1].join(roomID);
            console.log('INFO: Cliente ' + socket.id + ' entrou na sala: ' + roomID);
            clientsList[numClients-1].emit('joined', roomID, socket.id);
            clientsList[0].emit('ready', roomID); 
        } else { 
            clientsList[numClients-1].emit('full', roomID);
        }
    });

    socket.on('ipaddr', function() {
        var ifaces = os.networkInterfaces();
        for (var dev in ifaces) {
            ifaces[dev].forEach(function(details) {
                if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
                    clientsList[0].emit('ipaddr', details.address);
                }
            });
        }
    });

    socket.on('bye', function(){
        console.log('received bye');
    });

});
