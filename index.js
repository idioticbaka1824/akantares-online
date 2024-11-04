const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
// const io = new Server(server);
const io = new Server(server, {
  connectionStateRecovery: {}
});


let sessions = []; //a session looks like {hostName, guestName, time, hostID, guestID}



// app.get('/', (req, res) => {
  // res.send('<h1>Hello world</h1>');
// });

app.use(express.static('SCRIPT'));
app.use(express.static('BITMAP'));
app.use(express.static('WAVE'));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'akantares-index.html'));
});

io.on('connection', (socket) => {
	console.log('a user connected, ' + socket.id);
});

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});

io.on('connection', (socket) => {
	socket.on('hello event', (arg) => {
		console.log(arg); // 'world'
	});
});


io.on('connection', (socket) => {
	socket.on('hosting event', (session) => {
		session.hostID = socket.id; //client doesn't know what the server identifies it as, so when the session object was sent the hostID was still null and is now updated here
		sessions.push(session);
		console.log(sessions);
		socket.join(session.hostID); //the name given to the socket.io room is just the host id
		io.emit('hosting event', sessions);
	});
});
io.on('connection', (socket) => {
	socket.on('reload event', (arg) => {
		io.emit('reload event', sessions);
	});
});
io.on('connection', (socket) => {
	socket.on('joining event', (value) => { //value is stringified version of a session that guest wants to join
		let matchCheck = (obj) => JSON.stringify(obj) === value;
		let i = sessions.findIndex(matchCheck); //find where in the session list that particular session is
		if(typeof sessions[i] !== 'undefined'){
			sessions[i].guestID = socket.id; //and change the guestID value in it to that of the guest who wants to join
			console.log(sessions);
			socket.join(sessions[i].hostID); //guest joins same room as host
			io.emit('joining event', sessions);
			io.to(sessions[i].hostID).emit('start playing', sessions[i]);
		}
	});
});

//how to handle if host disconnects, or if guest disconnects, do i make them reload or what, what about lobby, etc.
io.on('connection', (socket) => {
	socket.on('disconnect', () => {
		console.log('user disconnected, ' + socket.id);
		for(i=0; i<sessions.length; i++){
			if(sessions[i].hostID==socket.id || sessions[i].guestID==socket.id){
				io.to(sessions[i].hostID).emit('disconnect event', null); //let the host and guest know that one of them disconnected so they get sent back to the lobby
				let spliced = sessions.splice(i, 1); //if host or guest disconnects, the session is removed from the lobby
				io.emit('reload event', sessions); //refresh lobby when this disconnection happens
			}
		}
	});
});


io.on('connection', (socket) => {
	socket.on('emoji event', (obj) => {
		io.to(obj.hostID).emit('emoji event', obj);
	});
});
//chat feature
io.on('connection', (socket) => {
  socket.on('chat event', (chatObject) => { //chatObject looks like this: {posterType:game.playerType, posterName:game.playerName, hostID:game.myHostID, message:chatInput.value}
    console.log(chatObject.posterType + ' of room ' + chatObject.hostID + ' said: ' + chatObject.message);
	io.to(chatObject.hostID).emit('chat event', chatObject);
  });
});

//what happens when you hit the fire button
io.on('connection', (socket) => {
  socket.on('fire event', (fireObject) => {
    console.log('fire event: ' + fireObject);
	io.to(fireObject.hostID).emit('fire event', fireObject);
  });
});

//after a hitting shot when the planets are redrawn
//todo!! this code is copied from the offline case in akantares.js. i need to add player repositioning code both there and here
io.on('connection', (socket) => {
  socket.on('resetPlanets event', (obj) => {
	let resetPlanetsObj = {numPlanets:0, planets:[]};
	resetPlanetsObj.numPlanets = 1+Math.floor(4*Math.random());
	for(let i=0; i<resetPlanetsObj.numPlanets; i++){
		resetPlanetsObj.planets[i] = {x:60+160*Math.random(), y:12+200*Math.random(), m:(Math.random()<0.3), h:0};
	}
    console.log('resetPlanets event: ' + resetPlanetsObj);
	io.to(obj.hostID).emit('resetPlanets event', resetPlanetsObj);
  });
});
