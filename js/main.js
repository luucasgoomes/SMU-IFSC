'use strict';

/****************************************************************************
* Configuração Inicial
****************************************************************************/

// Variáveis de Comunicação
var configuration = {
  'iceServers': [{
    'url': 'stun:stun.l.google.com:19302'
  }]
};
var roomURL = document.getElementById('url');
var isInitiator;
var peerConnInitiator = [];
var peerConn;
var peerConnCount = 0;
var dataChannelInitiator = [];
var dataChannel;
var room = window.location.hash.substring(1);

// Variáveis de Mídia
var mediaSource, mediaBuffer, remoteDestination, mediaDescription;
var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var audioNames = ['piano-a','piano-b','piano-c','piano-d','piano-e','piano-f','piano-g',
                  'violino-a','violino-b','violino-c','violino-d','violino-e','violino-f','violino-g',
                  'flauta-a','flauta-b','flauta-c','flauta-d','flauta-e','flauta-f','flauta-g',
                  'bateria-a','bateria-b','bateria-c','bateria-d','bateria-e','bateria-f','bateria-g'];
var audioKeys = ['8','9','3','4','5','6','7',
                 'i','o','e','r','t','y','u',
                 'j','k','s','d','f','g','h',
                 'n','m','z','x','c','v','b' ];
var audioSource;
var audioStatus = [];
var audioData = [];
var notes = [];

if (!room) {
  room = window.location.hash = randomToken();
}

for (var i = 0; i < audioNames.length; i++) {
    audioStatus[i] = false;
}

/****************************************************************************
* Sinalização
****************************************************************************/

var socket = io.connect();

socket.on('ipaddr', function(ipaddr) {
    console.log('INFO: IP do servidor - ' + ipaddr);
    if(isInitiator) updateRoomURL(ipaddr);
    getAudioFiles(ipaddr);
    console.log('INFO: Carregando arquivos completado!');
});

socket.on('created', function(room, playerID) {
    console.log('INFO: A sala ' + room + ' foi criada com sucesso!');
    console.log('INFO: Sou o Iniciador: ' + playerID);
    isInitiator = true;
    socket.emit('ipaddr');
});

socket.on('joined', function(room, playerID, ipaddr) {
    console.log('INFO: Entrei na sala: ' + room);
    console.log('INFO: Sou o jogador: ' + playerID);
    isInitiator = false;
    getAudioFiles(ipaddr);
    createPeerConnection(isInitiator, configuration);
});

socket.on('full', function(room) {
    alert('INFO: A sala ' + room + ' está cheia. Estou criando uma nova sala para você!');
    window.location.hash = '';
    window.location.reload();
});

socket.on('ready', function() {
    console.log('INFO: Conexão estabelecida!');
    createPeerConnection(isInitiator, configuration);
});

socket.on('message', function(message,room) {
    console.log('INFO: Jogador recebeu a mensagem: ' + message);
    signalingMessageCallback(message);
});

/****************************************************************************
* Início
****************************************************************************/

socket.emit('create or join', room);

/****************************************************************************
* Mídia
****************************************************************************/

function getAudioFiles(ipaddr){

    var request = [];
    for(var i = 0; i < audioNames.length; i++){
        (function(i) {
             request[i] = new XMLHttpRequest();
             request[i].open('GET', 'http://'+ipaddr+'/notas/'+audioNames[i]+'.wav', true);
             request[i].responseType = 'arraybuffer';
             request[i].onload = function() {
                audioData[i] = request[i].response;
            }
            request[i].send();
        })(i);
    }
}

function handleAudioSelect(note) {

    var position = audioNames.indexOf(note);
    if(!audioStatus[position]){
        playTon (note);
    }else{
        stopTon (note);
    }
}

var sources = [];
var notesPlayed = [];

function playTon (note) {      
              
    console.log('Nota:' + note);
    var position = audioNames.indexOf(note);
    console.log('Position: ' + position);
    console.log(audioStatus[position]); 

    if(audioStatus[position]) return;

    console.log('INFO: Executando a nota ' + note);

    var source = audioCtx.createBufferSource();
    audioCtx.decodeAudioData(audioData[position], function(buffer) {
        source.buffer = buffer;
        source.loop = true;
        source.connect(audioCtx.destination);
        source.start(0);   
        console.log('Position ajsdfh: ' + position);
        console.log(audioStatus); 
        audioStatus[position] = 1;
    },
    function(e){ console.log('ERRO: não foi possível a decodificação do áudio: ' + e.err); });
    
    console.log(audioStatus[position]); 
    sources.push(source);
    notesPlayed.push(note);
    
}

function stopTon (note) {

    var position = notesPlayed.indexOf(note); 

    console.log(audioStatus[position]);  

    if(!audioStatus[position]) return;
    
    console.log('INFO: Parando a nota ' + note);  
    
    sources[position].stop(0);
    audioStatus[position] = false;
    sources.splice(position,1);
    notesPlayed.splice(position,1);

    console.log(audioStatus[position]); 
            
}

/****************************************************************************
* WebRTC Peer Connection e Canal de Dados
****************************************************************************/

function signalingMessageCallback(message) {

    if (message.type === 'offer') {

        if(isInitiator){
            console.log('INFO: Eu Iniciador recebi uma oferta!');
            peerConnInitiator[peerConnCount].setRemoteDescription(new RTCSessionDescription(message), function() {}, logError);
            peerConnInitiator[peerConnCount].createAnswer(onLocalSessionCreated, logError);
        }else{
            console.log('INFO: Eu jogador recebi uma oferta!');   
            peerConn.setRemoteDescription(new RTCSessionDescription(message), function() {}, logError);
            peerConn.createAnswer(onLocalSessionCreated, logError);
        }

    }else if(message.type === 'answer') {
    
        if(isInitiator){
            console.log('INFO: Eu Iniciador recebi uma resposta!');
            peerConnInitiator[peerConnCount].setRemoteDescription(new RTCSessionDescription(message), function() {}, logError);
        }else{
            console.log('INFO: Eu jogador recebi uma resposta!');
            peerConn.setRemoteDescription(new RTCSessionDescription(message), function() {}, logError);
        }

    }else if(message.type === 'candidate') {
    
        if(isInitiator){
            console.log('INFO: Eu Iniciador recebi um candidato!');
            peerConnInitiator[peerConnCount].addIceCandidate(new RTCIceCandidate({ candidate: message.candidate}));
        }else{
            console.log('INFO: Eu jogador recebi um candidato!');
            peerConn.addIceCandidate(new RTCIceCandidate({ candidate: message.candidate}));
        }

    } else if (message === 'bye') {
    }
}

function createPeerConnection(isInitiator, config) {

    if(isInitiator){

        console.log('INFO: Número de conexões com o Iniciador: ' + peerConnCount)
        console.log('INFO: Estabelecendo conexão do lado Iniciador!');
        peerConnInitiator[peerConnCount] = new RTCPeerConnection(config);

        peerConnInitiator[peerConnCount].onicecandidate = function(event) {
            if (event.candidate) {
                sendMessage({
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate
                });
            }else{
                console.log('INFO: Fim dos candidatos ICE!');
            }
        };

        console.log('INFO: Estabelecendo canal de dados!');
        var label = 'audio' + peerConnCount;
        dataChannelInitiator[peerConnCount] = peerConnInitiator[peerConnCount].createDataChannel(label);  
        onDataChannelCreated(dataChannelInitiator[peerConnCount]);
        peerConnInitiator[peerConnCount].createOffer(onLocalSessionCreated, logError);

    }else{

        console.log('INFO: Estabelecendo conexão do lado Peer!');
        peerConn = new RTCPeerConnection(config);

        peerConn.onicecandidate = function(event) {
            if (event.candidate) {
                sendMessage({
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate
                });
            }else{
                console.log('INFO: Fim dos candidatos ICE!');
            }
        };

        peerConn.ondatachannel = function(event) {
            dataChannel = event.channel;
            onDataChannelCreated(dataChannel);
        };
    }
}

function onLocalSessionCreated(desc) {

    if(isInitiator){
        console.log('INFO: Criando sessão local como Inicializador: ', desc);
        peerConnInitiator[peerConnCount].setLocalDescription(desc, function() {
            console.log('INFO: Enviado descritor local como Incializador:', peerConnInitiator[peerConnCount].localDescription);
            sendMessage(peerConnInitiator[peerConnCount].localDescription);
        }, logError);  
    }else{
        console.log('INFO: Criando sessão local como Peer', desc);
        peerConn.setLocalDescription(desc, function() {
            console.log('INFO: Eviando descritor local como Peer:', peerConn.localDescription);
            sendMessage(peerConn.localDescription);
        }, logError);
    }

}


function onDataChannelCreated(channel) {

    channel.onopen = function() {
        console.log('INFO: Canal de dados estabelecido com sucesso!');
        peerConnCount = peerConnCount + 1;
    };

    channel.onmessage = function(event){
        if(isInitiator){
            sendNote(event.data);
        	handleAudioSelect(event.data);	 
        }else{
            handleAudioSelect(event.data);
        }	      
    }
}

/****************************************************************************
* Funções Auxiliares
****************************************************************************/

function randomToken() {
    return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
}

function logError(err) {
    console.log(err.toString(), err);
}

function sendMessage(message) {
    console.log('INFO: Jogador enviado a mensagem: ', message);
    socket.emit('message', { payload: message, roomID: room});
}

function updateRoomURL(ipaddr) {
    var url;
    if (!ipaddr) {
        url = location.href;
    } else {
        url = location.protocol + '//' + ipaddr + '/#' + room;
    }
    roomURL.innerHTML = url;
}

/****************************************************************************
* Button Fuctions
****************************************************************************/

function sendNote(note){
    if(isInitiator){
        if(dataChannelInitiator.length > 0){
            for(var i = 0; i < dataChannelInitiator.length; i++){
                if(dataChannelInitiator[i].readyState !== "closed") dataChannelInitiator[i].send(note);
            }
        }   
    }else{
        if(dataChannel != null) dataChannel.send(note);
    }
}

function mouseAction(note){
    if(isInitiator) handleAudioSelect(note);
    sendNote(note);
}

$(document).ready(function () {
    $(".nota").hover(	
        function () {
            $(this).attr("src", "img/" + this.id[this.id.length-1] + "_on.png");
            mouseAction(this.id);
        }, 
        function () {
            $(this).attr("src", "img/" + this.id[this.id.length-1] + "_off.png");
            mouseAction(this.id);
        }
    );
});


var keyAllowed = {};

$(document).keydown(function(e) {
    if (keyAllowed [e.which] === false) return;
    keyAllowed [e.which] = false;
    e = e || window.event;
    var charCode = e.keyCode || e.which;
    var charStr = String.fromCharCode(charCode).toLowerCase();
    var position = audioKeys.indexOf(charStr);
    var audioName = audioNames[position];
    if(audioName !== undefined){
        $('#'+audioName).attr("src", "img/" + audioName[audioName.length-1] + "_on.png");
        mouseAction(audioName)
    }
});

$(document).keyup(function(e) { 
    keyAllowed [e.which] = true;
    e = e || window.event;
    var charCode = e.keyCode || e.which;
    var charStr = String.fromCharCode(charCode).toLowerCase();
    var position = audioKeys.indexOf(charStr);
    var audioName = audioNames[position];
    if(audioName !== undefined){
        $('#'+audioName).attr("src", "img/" + audioName[audioName.length-1] + "_off.png");
        mouseAction(audioName)
    }
});








