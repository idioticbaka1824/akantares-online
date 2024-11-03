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


let sessions = []; //a session looks like {hostName, time, hostID, guestID}



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
		sessions[i].guestID = socket.id; //and change the guestID value in it to that of the guest who wants to join
		console.log(sessions);
		socket.join(sessions[i].hostID); //guest joins same room as host
		io.emit('joining event', sessions);
	});
});

//how to handle if host disconnects, or if guest disconnects, do i make them reload or what, what about lobby, etc.
io.on('connection', (socket) => {
	socket.on('disconnect', () => {
		console.log('user disconnected, ' + socket.id);
		for(i=0; i<sessions.length; i++){
			if(sessions[i].hostID == socket.id){ //if host disconnects, their name and potential session is removed from the lobby
				let spliced = sessions.splice(i, 1);
				io.emit('reload event', sessions); //refresh lobby when this disconnection happens
			}
		}
	});
});


//chat feature
io.on('connection', (socket) => {
  socket.on('chat event', (chatObject) => { //chatObject looks like this: {posterType:game.playerType, posterName:game.playerName, hostID:game.myHostID, message:chatInput.value}
    console.log(chatObject.posterType + ' of room ' + chatObject.hostID + ' said: ' + chatObject.message);
	io.to(chatObject.hostID).emit('chat event', chatObject);
  });
});


io.on('connection', (socket) => {
  socket.on('fire event', (msg) => {
    console.log('fire event: ' + msg);
  });
});

