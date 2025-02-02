const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const cors = require("cors");
// const corsOptions ={
   // origin:'*', 
   // credentials:true,            //access-control-allow-credentials:true
   // optionSuccessStatus:200,
// };

require('events').EventEmitter.defaultMaxListeners = 15; //more than 10 makes it think there's a memory leak. idk if there really is?

const app = express();

const server = createServer(app);
// const io = new Server(server);
const io = new Server(server, {
  connectionStateRecovery: {},
  cors: {
    origin: "*",
    credentials: true
  }
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
	io.emit('reload event', sessions);
});

server.listen(3000, () => {
  console.log('server running at port 3000');
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
		console.log('hosting event', sessions);
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
	socket.on('joining event', (value) => { //'value' is stringified version of a session that guest wants to join
		let matchCheck = (obj) => JSON.stringify(obj) === value[0];
		let i = sessions.findIndex(matchCheck); //find where in the session list that particular session is
		if(typeof sessions[i] !== 'undefined'){
			sessions[i].guestID = socket.id; //and change the guestID value in it to that of the guest who wants to join
			sessions[i].guestName = value[1];
			console.log('joining event', sessions);
			socket.join(sessions[i].hostID); //guest joins same room as host
			io.emit('joining event', sessions);
			io.to(sessions[i].hostID).emit('start playing', sessions[i]);
		}
		//also, if a host joins someone else's game, their hosted session should be deleted since they're not available to host it
		for(let i=0; i<sessions.length; i++){
			if(sessions[i].hostID == socket.id){
				let spliced = sessions.splice(i, 1);
				console.log('a host joined someone else', sessions);
				io.emit('reload event', sessions);
			}
		}
	});
});

//how to handle if host disconnects, or if guest disconnects, do i make them reload or what, what about lobby, etc.? i think this is mostly done
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
    // console.log(chatObject.posterType + ' of room ' + chatObject.hostID + ' said: ' + chatObject.message);
	io.to(chatObject.hostID).emit('chat event', chatObject);
  });
});

//what happens when you hit the fire button
io.on('connection', (socket) => {
  socket.on('fire event', (fireObject) => {
    // console.log('fire event: ' + fireObject);
	io.to(fireObject.hostID).emit('fire event', fireObject);
  });
});

function playerPlanetIntersect(resetPlanetsObj){
	let out = false;
		for(let i=0; i<resetPlanetsObj.planets.length; i++){
			let d = 4 + 8 + resetPlanetsObj.planets[i].m==0?8:12; //the 4 in front is just a little extra
			if( (Math.abs(resetPlanetsObj.planets[i].x-resetPlanetsObj.playerPos.x)<d && Math.abs(resetPlanetsObj.planets[i].y-resetPlanetsObj.playerPos.y)<d) || (Math.abs(resetPlanetsObj.planets[i].x-resetPlanetsObj.enemyPos.x)<d && Math.abs(resetPlanetsObj.planets[i].y-resetPlanetsObj.enemyPos.y)<d) ){
				out = true;
			}
		}
	return out;
}

//after a hitting shot when the planets are redrawn
io.on('connection', (socket) => {
  socket.on('resetPlanets event', (obj) => {
	console.log('received resetPlanets event');
	let resetPlanetsObj = {playerPos:{h:false}, enemyPos:{h:false}, numPlanets:0, planets:[]};
	resetPlanetsObj.numPlanets = 1+Math.floor(4*Math.random());
	for(let i=0; i<resetPlanetsObj.numPlanets; i++){
		resetPlanetsObj.planets[i] = {x:30+260*Math.random(), y:20+200*Math.random(), m:(Math.random()<0.3), h:0};
	}
	do{
		console.log('(re)drawing...');
		resetPlanetsObj.playerPos.x = 27 + Math.floor(65*Math.random());
		resetPlanetsObj.enemyPos.x = 320-27 - Math.floor(65*Math.random());
		resetPlanetsObj.playerPos.y = 20 + Math.floor(200*Math.random());
		resetPlanetsObj.enemyPos.y = 20 + Math.floor(200*Math.random());
		console.log(playerPlanetIntersect(resetPlanetsObj));
	} while(playerPlanetIntersect(resetPlanetsObj));
    // console.log('resetPlanets event: ' + resetPlanetsObj);
	io.to(obj.hostID).emit('resetPlanets event', resetPlanetsObj);
  });
});

//what to do when asking for a rematch
io.on('connection', (socket) => {
  socket.on('rematch event', (rematchObject) => {
	io.to(rematchObject.hostID).emit('rematch event', rematchObject);
  });
});
