'use strict';

/****************************************************************************
* Initial setup
****************************************************************************/

var serverIp = 'localhost';

var configuration = {
  'iceServers': [{
    'url': 'stun:stun.l.google.com:19302'
  }]
};

var roomURL = document.getElementById('url');
var context = new AudioContext();
var isInitiator;

var mediaSource, mediaBuffer, remoteDestination, mediaDescription;
var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var audioFiles = ['do','re','mi','fa','sol','la'];
var audioSources = [];
var request = [];

var room = window.location.hash.substring(1);
if (!room) {
  room = window.location.hash = randomToken();
}

/****************************************************************************
* Signaling server
****************************************************************************/

var socket = io.connect();

socket.on('ipaddr', function(ipaddr) {
  console.log('Server IP address is: ' + ipaddr);
  if(isInitiator) updateRoomURL(ipaddr);
});

socket.on('created', function(room, clientId) {
  console.log('Created room', room, '- my client ID is', clientId);
  isInitiator = true;
});

socket.on('joined', function(room, clientId) {
  console.log('This peer has joined room', room, 'with client ID', clientId);
  isInitiator = false;
  createPeerConnection(isInitiator, configuration);
});

socket.on('full', function(room) {
  alert('Room ' + room + ' is full. We will create a new room for you.');
  window.location.hash = '';
  window.location.reload();
});

socket.on('ready', function() {
  console.log('Socket is ready');
  createPeerConnection(isInitiator, configuration);
});

socket.on('message', function(message,room) {
  console.log('Client received message:', message);
  signalingMessageCallback(message);
});


/****************************************************************************
* Begin
****************************************************************************/

console.log('Obtendo os arquivos de áudio...');
getAudioFiles();

socket.emit('create or join', room);

if (location.hostname.match('localhost')) {
  socket.emit('ipaddr');
}

function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', { payload: message, roomID: room});
}

function updateRoomURL(ipaddr) {
  var url;
  if (!ipaddr) {
    url = location.href;
  } else {
    url = 'Copie o link para entrar na sala:   ' + location.protocol + '//' + ipaddr + ':8080/#' + room;
    console.log(url);
  }
  roomURL.innerHTML = url;
}

/****************************************************************************
* User media 
****************************************************************************/

function getAudioFiles(){

    var i = 0;
    for(var i = 0; i < 6; i++){
        (function(i) {
             audioSources[i] = audioCtx.createBufferSource();
             request[i] = new XMLHttpRequest();
             request[i].open('GET', 'http://'+serverIp+':3000/'+audioFiles[i]+'.wav', true);
             request[i].responseType = 'arraybuffer';
             request[i].onload = function() {
                var audioData = request[i].response;
                audioCtx.decodeAudioData(audioData, function(buffer) {
                    audioSources[i].buffer = buffer;
                    audioSources[i].loop = true;
                    audioSources[i].start();    
                    console.log('Nota ' + audioFiles[i] + ' carregada!');
                },
                function(e){ console.log("Error with decoding audio data" + e.err); });
            }
            request[i].send();
        })(i);
    }
}

function handleFileSelect(notes,op,when) {

    for(var i = 0; i < notes.length; i++){
        if(op){
            playTon (notes[i],when)
        }else{
            stopTon (notes[i],when)
        }
    } 
}

function playTon (note,when) {                            
    var position = audioFiles.indexOf(note);
    audioSources[position].connect(audioCtx.destination);
}

function stopTon (note,when) {

    $({to:0}).animate({to:1}, 1000*when, function() {
        var position = audioFiles.indexOf(note);
        audioSources[position].disconnect(audioCtx.destination);  
    })

//    setTimeout(function(){
//        var position = audioFiles.indexOf(note);
//        audioSources[position].disconnect(audioCtx.destination);
//    }, 1000*when);                          
}


/****************************************************************************
* WebRTC peer connection and data channel
****************************************************************************/

var peerConnInitiator = [];
var peerConn;
var peerConnCount = 0;
var dataChannelInitiator = [];
var dataChannel;
var notes = [];

function signalingMessageCallback(message) {

    if (message.type === 'offer') {

        if(isInitiator){
            console.log('Oferta Recebida como Inicializador!');
            peerConnInitiator[peerConnCount].setRemoteDescription(new RTCSessionDescription(message), function() {}, logError);
            peerConnInitiator[peerConnCount].createAnswer(onLocalSessionCreated, logError);
        }else{
            console.log('Oferta Recebida como Peer!');   
            peerConn.setRemoteDescription(new RTCSessionDescription(message), function() {}, logError);
            peerConn.createAnswer(onLocalSessionCreated, logError);
        }

    }else if(message.type === 'answer') {
    
        if(isInitiator){
            console.log('Resposta Recebida como Incializador!');
            peerConnInitiator[peerConnCount].setRemoteDescription(new RTCSessionDescription(message), function() {}, logError);
        }else{
            console.log('Resposta Recebida como Peer!');
            peerConn.setRemoteDescription(new RTCSessionDescription(message), function() {}, logError);
        }

    }else if(message.type === 'candidate') {
    
        if(isInitiator){
            console.log('Candidato Recebido como Incializador!');
            peerConnInitiator[peerConnCount].addIceCandidate(new RTCIceCandidate({ candidate: message.candidate}));
        }else{
            console.log('Candidato Recebido como Peer!');
            peerConn.addIceCandidate(new RTCIceCandidate({ candidate: message.candidate}));
        }

    } else if (message === 'bye') {

    }
}

function createPeerConnection(isInitiator, config) {

    if(isInitiator){

        console.log('PeerConn Count: ' + peerConnCount)

        console.log("Criando conexão P2P do lado Iniciador!");
        peerConnInitiator[peerConnCount] = new RTCPeerConnection(config);

        peerConnInitiator[peerConnCount].onicecandidate = function(event) {
            console.log('Evento Candidato ICE - Iniciador:', event);
            if (event.candidate) {
                sendMessage({
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate
                });
            }else{
                console.log('Fim dos candidatos');
            }
        };

        console.log('Criado canal de dados!');
        var label = 'audio' + peerConnCount;
        console.log('Label: ' + label);
        dataChannelInitiator[peerConnCount] = peerConnInitiator[peerConnCount].createDataChannel(label);  
        onDataChannelCreated(dataChannelInitiator[peerConnCount]);
        console.log('Criando uma oferta!');
        peerConnInitiator[peerConnCount].createOffer(onLocalSessionCreated, logError);

    }else{

        console.log("Criando conexão P2P do lado Peer!");
        peerConn = new RTCPeerConnection(config);

        peerConn.onicecandidate = function(event) {
            console.log('Evento Candidato ICE - Peer:', event);
            if (event.candidate) {
                sendMessage({
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate
                });
            }else{
                console.log('Fim dos candidatos!');
            }
        };

        peerConn.ondatachannel = function(event) {
            console.log('On DataChannel - Peer:', event.channel);
            dataChannel = event.channel;
            onDataChannelCreated(dataChannel);
        };
    }
}

function onLocalSessionCreated(desc) {

    if(isInitiator){
        console.log('Criando sessão local como Inicializador: ', desc);
        peerConnInitiator[peerConnCount].setLocalDescription(desc, function() {
            console.log('Enviado descritor local como Incializador:', peerConnInitiator[peerConnCount].localDescription);
            sendMessage(peerConnInitiator[peerConnCount].localDescription);
        }, logError);  
    }else{
        console.log('Criando sessão local como Peer', desc);
        peerConn.setLocalDescription(desc, function() {
            console.log('Eviando descritor local como Peer:', peerConn.localDescription);
            sendMessage(peerConn.localDescription);
        }, logError);
    }

}


function onDataChannelCreated(channel) {
  console.log('onDataChannelCreated:', channel);

  channel.onopen = function() {
    console.log('CHANNEL opened!!!');
    peerConnCount = peerConnCount + 1;
  };

  channel.onmessage = function(event){

    notes.push(event.data);

    if(isInitiator){
        console.log('Notas: ' + notes);
        sendNote(notes);
    	handleFileSelect(notes,1,0);
        handleFileSelect(notes,0,0.49);
        notes.length = 0;	 
    }else{
        console.log('Nota: ' + notes);
        handleFileSelect(notes,1,0);
        handleFileSelect(notes,0,0.49);
        notes.length = 0;
    }
	      
  }
}

/****************************************************************************
* Aux functions, mostly UI-related
****************************************************************************/

function randomToken() {
  return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
}

function logError(err) {
  console.log(err.toString(), err);
}

function sendNote(note){
    if(isInitiator){
        if(dataChannelInitiator.length > 0){
            for(var i = 0; i < dataChannelInitiator.length; i++){
                dataChannelInitiator[i].send(note);
            }
        }   
    }else{
        if(dataChannel != null) dataChannel.send(note);
    }
}

/****************************************************************************
* Button Fuctions
****************************************************************************/

$(document).ready(function () {

    $("#redbox").mouseover(function(){
        $("#redbox").attr("src", "img/mouseover_box.png");
        var note = [];
        note.push('do');
        if(isInitiator){
             handleFileSelect(note,1,0);
             handleFileSelect(note,0,0.60);
        }
        sendNote(note);
    });
    $("#redbox").mouseout(function(){
        $("#redbox").attr("src", "img/red_box.png");
//        var note = [];
//        note.push('do');        
//        if(isInitiator) handleFileSelect(note,0,0);
    });

    $("#greenbox").mouseover(function(){
        $("#greenbox").attr("src", "img/mouseover_box.png");
        var note = [];
        note.push('re');
        if(isInitiator){
             handleFileSelect(note,1,0);
             handleFileSelect(note,0,0.60);
        }
        sendNote(note);
    });
    $("#greenbox").mouseout(function(){
        $("#greenbox").attr("src", "img/green_box.png");
//        var note = [];
//        note.push('re');        
//        if(isInitiator) handleFileSelect(note,0,0);
    });


    $("#bluebox").mouseover(function(){
        $("#bluebox").attr("src", "img/mouseover_box.png");
        var note = [];
        note.push('mi');
        if(isInitiator){
             handleFileSelect(note,1,0);
             handleFileSelect(note,0,0.60);
        }
        sendNote(note);
    });
    $("#bluebox").mouseout(function(){
        $("#bluebox").attr("src", "img/blue_box.png");
//        var note = [];
//        note.push('mi');        
//        if(isInitiator) handleFileSelect(note,0,0);
    });


    $("#purplebox").mouseover(function(){
        $("#purplebox").attr("src", "img/mouseover_box.png");
        var note = [];
        note.push('fa');
        if(isInitiator){
             handleFileSelect(note,1,0);
             handleFileSelect(note,0,0.60);
        }
        sendNote(note);
    });

    $("#purplebox").mouseout(function(){
        $("#purplebox").attr("src", "img/purple_box.png");
//        var note = [];
//        note.push('fa');        
//        if(isInitiator) handleFileSelect(note,0,0);
    });


    $("#yellowbox").mouseover(function(){
        $("#yellowbox").attr("src", "img/mouseover_box.png");
        var note = [];
        note.push('sol');
        if(isInitiator){
             handleFileSelect(note,1,0);
             handleFileSelect(note,0,0.60);
        }
        sendNote(note);
    });

    $("#yellowbox").mouseout(function(){
        $("#yellowbox").attr("src", "img/yellow_box.png");
//        var note = [];
//        note.push('sol');        
//        if(isInitiator) handleFileSelect(note,0,0);    
    });

    $("#blackbox").mouseover(function(){
        $("#blackbox").attr("src", "img/mouseover_box.png");
        var note = [];
        note.push('la');
        if(isInitiator){
             handleFileSelect(note,1,0);
             handleFileSelect(note,0,0.60);
        }
        sendNote(note);
    });

    $("#blackbox").mouseout(function(){
        $("#blackbox").attr("src", "img/black_box.png");
//        var note = [];
//        note.push('la');        
//        if(isInitiator) handleFileSelect(note,0,0);
    });


});






