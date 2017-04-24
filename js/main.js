'use strict';

/****************************************************************************
* Initial setup
****************************************************************************/

var serverIp = '191.36.11.210';

var configuration = {
  'iceServers': [{
    'url': 'stun:stun.l.google.com:19302'
  }]
};
// {'url': 'stun:stun.services.mozilla.com'}


var roomURL = document.getElementById('url');
var context = new AudioContext();

// Create a random room if not already present in the URL.
var isInitiator;
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
  updateRoomURL(ipaddr);
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

socket.on('log', function(array) {
  console.log.apply(console, array);
});

socket.on('message', function(message) {
  console.log('Client received message:', message);
  signalingMessageCallback(message);
});


/****************************************************************************
* Begin
****************************************************************************/

socket.emit('create or join', room);

if (location.hostname.match(/localhost|127\.0\.0/)) {
  socket.emit('ipaddr');
}

/**
* Send message to signaling server
*/
function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

/**
* Updates URL on the page so that users can copy&paste it to their peers.
*/
function updateRoomURL(ipaddr) {
  var url;
  if (!ipaddr) {
    url = location.href;
  } else {
    url = location.protocol + '//' + ipaddr + ':8080/#' + room;
    console.log(url);
  }
  roomURL.innerHTML = url;
  // roomURL.text = url;
}

/****************************************************************************
* User media 
****************************************************************************/

var mediaSource, mediaBuffer, remoteDestination, mediaDescription;

function handleFileSelect(audio,op,when) {

    if(op){
        playTon (audio,when)
    }else{
        stopTon (audio,when)
    }
}

var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var source;

function getAudio(audio){
    source = audioCtx.createBufferSource();
    var request = new XMLHttpRequest();
    request.open('GET', 'http://'+serverIp+':3000/'+audio+'.wav', true);
    request.responseType = 'arraybuffer';

    request.onload = function() {
    var audioData = request.response;

    audioCtx.decodeAudioData(audioData, function(buffer) {
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.loop = true;
      },
      function(e){ console.log("Error with decoding audio data" + e.err); });
  }
  request.send();
}

function playTon (audio,when) {                           //start wind audio
    getAudio(audio);    
    source.start(when);
}

function stopTon (audio,when) {                           //stop the wind audio
    source.stop(audioCtx.currentTime + when);
}


/****************************************************************************
* WebRTC peer connection and data channel
****************************************************************************/

var peerConn;
var dataChannel;

function signalingMessageCallback(message) {
  if (message.type === 'offer') {
    console.log('Got offer. Sending answer to peer.');
    peerConn.setRemoteDescription(new RTCSessionDescription(message), function() {},
                                  logError);
    peerConn.createAnswer(onLocalSessionCreated, logError);

  } else if (message.type === 'answer') {
    console.log('Got answer.');
    peerConn.setRemoteDescription(new RTCSessionDescription(message), function() {},
                                  logError);

  } else if (message.type === 'candidate') {
    peerConn.addIceCandidate(new RTCIceCandidate({
      candidate: message.candidate
    }));

  } else if (message === 'bye') {
// TODO: cleanup RTC connection?
}
}

function createPeerConnection(isInitiator, config) {
  console.log('Creating Peer connection as initiator?', isInitiator, 'config:',
              config);
     peerConn = new RTCPeerConnection(config);

// send any ice candidates to the other peer
peerConn.onicecandidate = function(event) {
  console.log('icecandidate event:', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
};

if (isInitiator) {
  console.log('Creating Data Channel');
  dataChannel = peerConn.createDataChannel('audio');
  onDataChannelCreated(dataChannel);

  console.log('Creating an offer');
  peerConn.createOffer(onLocalSessionCreated, logError);
} else {
  peerConn.ondatachannel = function(event) {
    console.log('ondatachannel:', event.channel);
    dataChannel = event.channel;
    onDataChannelCreated(dataChannel);
  };
}
}

function onLocalSessionCreated(desc) {
  console.log('local session created:', desc);
  peerConn.setLocalDescription(desc, function() {
    console.log('sending local desc:', peerConn.localDescription);
    sendMessage(peerConn.localDescription);
  }, logError);
}

//var audioCtx2 = new (window.AudioContext || window.webkitAudioContext)();
//var source2;

function onDataChannelCreated(channel) {
  console.log('onDataChannelCreated:', channel);

  channel.onopen = function() {
    console.log('CHANNEL opened!!!');
  };

  channel.onmessage = function(event){
    console.log('Received data: ' + event.data);
	handleFileSelect(event.data,1,0);
    handleFileSelect(event.data,0,0.5);	      	      
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

/****************************************************************************
* Button Fuctions
****************************************************************************/

$(document).ready(function () {

    $("#redbox").mouseover(function(){
        $("#redbox").attr("src", "img/mouseover_box.png");
        handleFileSelect("do",1,0);
        dataChannel.send("do");
    });
    $("#redbox").mouseout(function(){
        $("#redbox").attr("src", "img/red_box.png");
        handleFileSelect("do",0,0);
    });

    $("#greenbox").mouseover(function(){
        $("#greenbox").attr("src", "img/mouseover_box.png");
        handleFileSelect("re",1,0);
        dataChannel.send("re");
    });
    $("#greenbox").mouseout(function(){
        $("#greenbox").attr("src", "img/green_box.png");
        handleFileSelect("re",0,0);
    });

    $("#bluebox").mouseover(function(){
        $("#bluebox").attr("src", "img/mouseover_box.png");
        handleFileSelect("mi",1,0);
        dataChannel.send("mi");
    });
    $("#bluebox").mouseout(function(){
        $("#bluebox").attr("src", "img/blue_box.png");
        handleFileSelect("mi",0,0);
    });

    $("#purplebox").mouseover(function(){
        $("#purplebox").attr("src", "img/mouseover_box.png");
        handleFileSelect("fa",1,0);
        dataChannel.send("fa");
    });
    $("#purplebox").mouseout(function(){
        $("#purplebox").attr("src", "img/purple_box.png");
        handleFileSelect("fa",0,0);
    });

    $("#yellowbox").mouseover(function(){
        $("#yellowbox").attr("src", "img/mouseover_box.png");
        handleFileSelect("sol",1,0);
        dataChannel.send("sol");
    });
    $("#yellowbox").mouseout(function(){
        $("#yellowbox").attr("src", "img/yellow_box.png");
        handleFileSelect("sol",0,0);    
    });

    $("#blackbox").mouseover(function(){
        $("#blackbox").attr("src", "img/mouseover_box.png");
        handleFileSelect("la",1,0);
        dataChannel.send("la");
    });
    $("#blackbox").mouseout(function(){
        $("#blackbox").attr("src", "img/black_box.png");
        handleFileSelect("la",0,0);
    });

});






