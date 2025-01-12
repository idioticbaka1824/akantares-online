(() => {
	
	//mod function
	function abs(x){
		return x>0 ? x : -1*x;
	}
	
	//utility function to force a number to within an allowed interval
	function clamp(number, min, max) {
		return Math.max(min, Math.min(number, max));
	}
	
	//pythagoras
	function dist2(dx, dy, dz=0){
		return (dx**2 + dy**2 + dz**2)**0.5;
	}
	function dist4(x1, x2, y1, y2){
		return ((x1-x2)**2 + (y1-y2)**2)**0.5;
	}
	
	//dot product
	function dot(v1x, v1y, v2x, v2y){
		return v1x*v2x + v1y*v2y;
	}
	
	//angle between two vectors
	function angle(v1x, v1y, v2x, v2y){
		//return Math.acos(dot(v1x,v1y,v2x,v2y)/(dist2(v1x,v1y)*dist2(v2x,v2y)));
		return Math.atan2(v2y,v2x) - Math.atan2(v1y,v1x);
	}
	
    class Game {
        constructor() {
			this.gameMode = 2; //0,1,2 = singleplayer, multiplayer offline, multiplayer online, instructions screen
			this.numGameModes = 4;
			this.whoseTurn = 0; //0,1 = player1 or player2 (during 2player offline)
			this.gameState = 'loading'; //loading, startscreen, playing, escmenu, gameover. actually, no gameover.
			this.gameSubState = 'null'; //if gameState == 'playing', this can be 'ready', 'countdown', 'flying', 'collided', 'win','lose','draw'. otherwise it is 'null'. //update: for gameMode=3 this can be 1 or 2 for instruction pages
			this.level = 0;
			this.help = false;
			this.previousGameState = 'loading';
			this.keyHasBeenPressed = {horizontal:0, vertical:0};
			this.numInstructions = 3;
			
			//stuff needed for online 2player
			this.playerType = 'guest';
			this.disabled = false; //whether your controls are disabled temporarily (e.g. when waiting for opponent's shot)
			this.hostFired = false;
			this.guestFired = false;
			this.sessions = []; //for listing them in the lobby. see server's index.js for structure of a session object
			this.mySocketID = null;
			this.myHostID = null;
			this.lobbyString = 'strNull';
			this.buttonDepress = null; //0,1,2,3: join,host,quit,reload
			this.chat = [];
			this.hostName = '';
			this.guestName = '';
			this.hostEmoji = 0;
			this.guestEmoji = 0;
			this.disconnectTimer = false; //there has to be a better way for this but eh
			this.rematch = {'host':null, 'guest':null};
			this.rematchChoice = 1;
			this.rematchChoiceMade = null;
			
			//misc
			this.score = [0,0];
			this.justStartedPlaying = true;
			
			//physics
			this.dt = 0.05; //time step for integrating motion
			this.G = 9000; //universal gravitational constant
			this.initCatapultSpeed = 21;
			this.playerMass = 0.3;
			this.planetMass = 1; //sets the unit mass scale and is thus incorporated into the definition of G as well. do not change
			this.bigPlanetMass = 2;
			this.z_conditioning = 3.2; //see movement code in 'flying' case
			this.lambda = 1/610; //linear mass density of repulsive dark matter at edges of screen
			this.respiteFrames = 10; //# of frames at beginning when player gravity is disabled
			this.fadeinDuration = 0.2;
			this.resumeFrame = 0; //keep track of which frame you were on when paused, so that the game doesn't keep going in the background
			
			this.playerName = 'debugName';
			this.playerAngle = 360;
			this.playerPos = {x:40, y:window.height/2, h:false}; //h for whether it's been hit
			this.playerMissilePos = {x:this.playerPos.x+10*Math.cos(this.playerAngle*Math.PI/180), y:this.playerPos.y+10*Math.sin(this.playerAngle*Math.PI/180)};
			this.playerMissileVel = {x:0, y:0};
			this.playerMissileAcc = {x:0, y:0};
			this.playerTrail = [];
			this.playerCollided = false; //whether or not player's missile has collided with something
			this.enemyAngle = 360*Math.random();
			this.enemyPos = {x:256, y:window.height/2, h:false};
			this.enemyMissilePos = {x:this.enemyPos.x+10*Math.cos(this.enemyAngle*Math.PI/180), y:this.enemyPos.y+10*Math.sin(this.enemyAngle*Math.PI/180)};
			this.enemyMissileVel = {x:0, y:0};
			this.enemyMissileAcc = {x:0, y:0};
			this.enemyTrail = [];
			this.enemyCollided = false;
			
			this.resultString = '';
			
			this.resetStuff('planets');
			
        
			this.debugInvulnerability = false;
		}
		
		playerPlanetIntersect(){
			let out = false;
			for(let i=0; i<this.planets.length; i++){
				let d = 4 + 8 + this.planets[i].m==0?8:12;
				if( (Math.abs(this.planets[i].x-this.playerPos.x)<d && Math.abs(this.planets[i].y-this.playerPos.y)<d) || (Math.abs(this.planets[i].x-this.enemyPos.x)<d && Math.abs(this.planets[i].y-this.enemyPos.y)<d) ){
					out = true;
				}
			}
			return out;
		}
		
		fire(arg='emit'){
			if(this.gameMode!=2 || !this.justStartedPlaying){ //otherwise firing will cause the nameplates to re-popup (nameplates only used in online mode)
				ui.sfxs['OK'].play();
				
				if(arg=='emit' && !(this.gameMode==1 && this.whoseTurn==0)){
					document.getElementById('fireRange').style.visibility = 'hidden';
					document.getElementById('fireButton').disabled = true;
					ui.frameCount = 0;
				}
				if(this.gameMode == 2 && arg=='emit'){
					if(this.playerType == 'host'){this.hostFired = true;}
					if(this.playerType == 'guest'){this.guestFired = true;}
					
					let fireObject = {hostID: this.myHostID, hostFired:this.hostFired, guestFired:this.guestFired, hostAngle:null, guestAngle:null};
					if(this.playerType=='host'){fireObject.hostAngle=this.playerAngle;}
					if(this.playerType=='guest'){fireObject.guestAngle=this.enemyAngle;}
					socket.emit('fire event', fireObject);
					ui.frameCount = 0;
				}
				
				if(this.gameMode==0 || (this.gameMode==1 && this.whoseTurn>0) || (this.hostFired&&this.guestFired)){
					this.resultString = '';
					this.resetStuff('trail');
					this.resetStuff('shot');
					this.gameSubState = 'countdown';
					ui.frameCount = 0;
				}
				if(this.gameMode==1){this.whoseTurn = this.whoseTurn + 1;	ui.frameCount = 0;}
			}
		}
		
		resetStuff(arg){ //make a separate resetGame and resetForNextLevel and reset after shot? yeah, make reset thingies for various cases
			for(let sfxName in ui.muteSFX){ui.muteSFX[sfxName]=false;}
			switch(arg){
				case 'trail':
					this.playerTrail = [];
					this.enemyTrail = [];
					break;
					
				case 'planets':
					this.resetStuff('trail');
					this.planets = [];
					if(this.gameMode != 2){
						this.numPlanets = 1+Math.floor(4*Math.random());
						for(let i=0; i<this.numPlanets; i++){
							this.planets[i] = {x:30+260*Math.random(), y:20+200*Math.random(), m:(Math.random()<0.3), h:0};
						}
						do{
							this.playerPos.x = 25 + Math.floor(65*Math.random());
							this.enemyPos.x = 320-25 - Math.floor(65*Math.random());
							this.playerPos.y = 20 + Math.floor(200*Math.random());
							this.enemyPos.y = 20 + Math.floor(200*Math.random());
						}
						while(this.playerPlanetIntersect());
					}
					if(this.gameMode == 2 && socket != null){socket.emit('resetPlanets event', {hostID:this.myHostID});}
					break;
					
				case 'gameover':
					this.score = [0,0];
					this.resetStuff('trail');
					this.resetStuff('planets');
					this.resetStuff('shot');
					this.hostEmoji = 0;
					this.guestEmoji = 0;
					// document.getElementById('emoji-select').selectedIndex = 0;
					this.justStartedPlaying = true;
					break;
				
				case 'shot':
					this.playerMissileVel.x = this.initCatapultSpeed*Math.cos(this.playerAngle*Math.PI/180);
					this.playerMissilePos.x = this.playerPos.x + 10*Math.cos(this.playerAngle*Math.PI/180);
					this.playerMissileVel.y = this.initCatapultSpeed*Math.sin(this.playerAngle*Math.PI/180);
					this.playerMissilePos.y = this.playerPos.y + 10*Math.sin(this.playerAngle*Math.PI/180);
					if(this.gameMode==0){this.enemyAngle = 360*Math.random();}
					this.enemyMissileVel.x = this.initCatapultSpeed*Math.cos(this.enemyAngle*Math.PI/180);
					this.enemyMissilePos.x = this.enemyPos.x + 10*Math.cos(this.enemyAngle*Math.PI/180);
					this.enemyMissileVel.y = this.initCatapultSpeed*Math.sin(this.enemyAngle*Math.PI/180);
					this.enemyMissilePos.y = this.enemyPos.y + 10*Math.sin(this.enemyAngle*Math.PI/180);
					
					this.playerPos.h = false;
					this.enemyPos.h = false;
					this.playerCollided = false;
					this.enemyCollided = false;
					this.whoseTurn = 0;
					this.disabled = '';
					this.hostFired = false;
					this.guestFired = false;
					this.disabled = false;
					
					if(this.resultString.slice(-3)=='hit'){this.resetStuff('planets');}
					this.planets = this.planets.filter((p)=>p.h-p.m<2);
					
					document.getElementById('fireButton').disabled = false;
								
				break;
			}
			ui.frameCount = 0;
		}
		
		readyFadeIn(){ //for the fade-in animation. to let the ui script know, i'm encoding this info in the fact that the frame counter is negative.
			ui.frameCount = -this.fadeinDuration*window.fps;
		}
		
		
        update() {
			
			ui.hasSinceUpdated = true;
			
			this.keyHandling(window.keysBeingPressed);
			
			switch(this.gameState){
				
				case 'loading':
					break;
				
				case 'startscreen':
					this.justStartedPlaying = true;
					break;
				
				case 'lobby':
					if(!navigator.onLine){
						this.lobbyString = 'strError';
					}
					break;
				
				case 'playing':
					
					if(document.getElementById('fireDiv').style.visibility=='hidden'){document.getElementById('fireDiv').style.visibility='visible';}
					if(document.getElementById('fireDiv').style.opacity==0){document.getElementById('fireDiv').style.opacity=1;}
					if(this.gameMode==2){
						document.getElementById('chat-container').style.visibility = 'visible';
						document.getElementById('lobbyList').style.visibility = 'hidden';
						this.disabled = (this.playerType=='host' && this.hostFired) || (this.playerType=='guest' && this.guestFired);
					}
					if(ui.frameCount>1.5*window.fps){
						this.justStartedPlaying = false;
					}
					if(ui.frameCount>3*window.fps){
						if(this.disconnectTimer == true){
							this.disconnectTimer = false;
							ui.stop_bgm();
							window.audioContext.resume();
							this.gameState = 'startscreen';
							this.previousGameState = 'startscreen';
							this.readyFadeIn;
							document.getElementById('chat-container').style.visibility = 'hidden';
						}
					}
										
					switch(this.gameSubState){
						
						case 1:
							break;
						case 2:
							break;
						
						case 'ready':
							if((game.gameMode==0) || (game.gameMode==1 && game.whoseTurn==0) || (game.gameMode==2 && game.playerType=='host' && this.disabled==false)){this.playerAngle = document.getElementById('fireRange').value;} //using 'game.' instead of 'this.' for some conditions because they were copied over from the html file. it still seems to work so never mind
							else if((game.gameMode==1 && game.whoseTurn==1) || (game.gameMode==2 && game.playerType=='guest' && this.disabled==false)){this.enemyAngle = document.getElementById('fireRange').value;}
							break;
							
						case 'countdown':
							document.getElementById('fireButton').disabled = true;
							if(ui.frameCount > 2*window.fps){
								this.resultString = ''; //putting this here instead of in the reset function so that the ui script knows what happened last and can decide whether or not to fade-in
								this.gameSubState = 'flying';
								ui.frameCount=0;
							}
							break;
							
						case 'flying':
							document.getElementById('fireButton').disabled = true;
							//player missile movement
							if(!this.playerCollided){
								this.playerMissileAcc.x = 0;
								//respite frames disable the effect of gravity of the player for a bit at the beginning so that the catapult doesn't just get stuck orbiting the player
								if(ui.frameCount>this.respiteFrames) {this.playerMissileAcc.x -= this.G*this.playerMass*(this.playerMissilePos.x-this.playerPos.x)*dist2(this.playerMissilePos.x-this.playerPos.x, this.playerMissilePos.y-this.playerPos.y, this.z_conditioning*10)**-3;} //the dz=10 is to make sure it's always some distance away from the planet, to avoid singularities. the this.z_conditioning tunes this effect
								this.playerMissileAcc.x -= this.G*this.playerMass*(this.playerMissilePos.x-this.enemyPos.x)*dist2(this.playerMissilePos.x-this.enemyPos.x, this.playerMissilePos.y-this.enemyPos.y, this.z_conditioning*10)**-3;
								for(let i=0; i<this.planets.length; i++){
									this.playerMissileAcc.x -= this.G*(this.planets[i].m==0?this.planetMass:this.bigPlanetMass)*(this.playerMissilePos.x-this.planets[i].x)*dist2(this.playerMissilePos.x-this.planets[i].x, this.playerMissilePos.y-this.planets[i].y, this.z_conditioning*(10+4*this.planets[i].m))**-3;
								}
								//to avoid the shots straying too far offscreen, i place 'dark matter' at the edges of the screen, modeled as infinitely long lines of mass placed along the 4 edges with a certain linear mass density. these are tuned so as to always guide the shot toward the interior of the screen no matter where the shot is, so this would actually be physically impossible. but this is a game so eh
								this.playerMissileAcc.x += 2*this.G*this.lambda*(dist2(this.playerMissilePos.x, this.z_conditioning*10)**-1 - dist2(window.width-this.playerMissilePos.x, this.z_conditioning*10)**-1);
								//finally, simple first order integration of motion using the calculated acceleration
								this.playerMissileVel.x += this.dt*this.playerMissileAcc.x;
								this.playerMissilePos.x += this.dt*this.playerMissileVel.x;
								
								this.playerMissileAcc.y = 0;
								if(ui.frameCount>this.respiteFrames) {this.playerMissileAcc.y -= this.G*(this.playerMissilePos.y-this.playerPos.y)*dist2(this.playerMissilePos.x-this.playerPos.x, this.playerMissilePos.y-this.playerPos.y, this.z_conditioning*10)**-3;}
								this.playerMissileAcc.y -= this.G*(this.playerMissilePos.y-this.enemyPos.y)*dist2(this.playerMissilePos.x-this.enemyPos.x, this.playerMissilePos.y-this.enemyPos.y, this.z_conditioning*10)**-3;
								for(let i=0; i<this.planets.length; i++){
									this.playerMissileAcc.y -= this.G*(this.planets[i].m==0?this.planetMass:this.bigPlanetMass)*(this.playerMissilePos.y-this.planets[i].y)*dist2(this.playerMissilePos.x-this.planets[i].x, this.playerMissilePos.y-this.planets[i].y, this.z_conditioning*(10+4*this.planets[i].m))**-3;
								}
								this.playerMissileAcc.y += 2*this.G*this.lambda*(dist2(this.playerMissilePos.y, this.z_conditioning*10)**-1 - dist2(window.height-this.playerMissilePos.y, this.z_conditioning*10)**-1);
								this.playerMissileVel.y += this.dt*this.playerMissileAcc.y;
								this.playerMissilePos.y += this.dt*this.playerMissileVel.y;
							}
							//enemy missile movement
							if(!this.enemyCollided){
								this.enemyMissileAcc.x = 0;
								if(ui.frameCount>this.respiteFrames) {this.enemyMissileAcc.x -= this.G*this.playerMass*(this.enemyMissilePos.x-this.enemyPos.x)*dist2(this.enemyMissilePos.x-this.enemyPos.x, this.enemyMissilePos.y-this.enemyPos.y, this.z_conditioning*10)**-3;}
								this.enemyMissileAcc.x -= this.G*this.playerMass*(this.enemyMissilePos.x-this.playerPos.x)*dist2(this.enemyMissilePos.x-this.playerPos.x, this.enemyMissilePos.y-this.playerPos.y, this.z_conditioning*10)**-3;
								for(let i=0; i<this.planets.length; i++){
									this.enemyMissileAcc.x -= this.G*(this.planets[i].m==0?this.planetMass:this.bigPlanetMass)*(this.enemyMissilePos.x-this.planets[i].x)*dist2(this.enemyMissilePos.x-this.planets[i].x, this.enemyMissilePos.y-this.planets[i].y, this.z_conditioning*(10+4*this.planets[i].m))**-3;
								}
								this.enemyMissileAcc.x += 2*this.G*this.lambda*(dist2(this.enemyMissilePos.x, this.z_conditioning*10)**-1 - dist2(window.width-this.enemyMissilePos.x, this.z_conditioning*10)**-1);
								this.enemyMissileVel.x += this.dt*this.enemyMissileAcc.x;
								this.enemyMissilePos.x += this.dt*this.enemyMissileVel.x;
								
								this.enemyMissileAcc.y = 0;
								if(ui.frameCount>this.respiteFrames) {this.enemyMissileAcc.y -= this.G*this.playerMass*(this.enemyMissilePos.y-this.enemyPos.y)*dist2(this.enemyMissilePos.x-this.enemyPos.x, this.enemyMissilePos.y-this.enemyPos.y, this.z_conditioning*10)**-3;}
								this.enemyMissileAcc.y -= this.G*this.playerMass*(this.enemyMissilePos.y-this.playerPos.y)*dist2(this.enemyMissilePos.x-this.playerPos.x, this.enemyMissilePos.y-this.playerPos.y, this.z_conditioning*10)**-3;
								for(let i=0; i<this.planets.length; i++){
									this.enemyMissileAcc.y -= this.G*(this.planets[i].m==0?this.planetMass:this.bigPlanetMass)*(this.enemyMissilePos.y-this.planets[i].y)*dist2(this.enemyMissilePos.x-this.planets[i].x, this.enemyMissilePos.y-this.planets[i].y, this.z_conditioning*(10+4*this.planets[i].m))**-3;
								}
								this.enemyMissileAcc.y += 2*this.G*this.lambda*(dist2(this.enemyMissilePos.y, this.z_conditioning*10)**-1 - dist2(window.height-this.enemyMissilePos.y, this.z_conditioning*10)**-1);
								this.enemyMissileVel.y += this.dt*this.enemyMissileAcc.y;
								this.enemyMissilePos.y += this.dt*this.enemyMissileVel.y;
							}
							
							if(ui.frameCount%12 == 0){
								this.playerTrail.push({x:this.playerMissilePos.x, y:this.playerMissilePos.y});
								this.enemyTrail.push({x:this.enemyMissilePos.x, y:this.enemyMissilePos.y});
							}
							
							
							
							//collisions
					
							if(!this.debugInvulnerability && ui.frameCount>this.respiteFrames){
								
								//playerMissile - enemy
								if(abs(this.playerMissilePos.x-this.enemyPos.x)<10 && abs(this.playerMissilePos.y-this.enemyPos.y)<10){
									if(!this.playerCollided){this.score[0] += 1; ui.sfxs['HIT'].play();} //if not for this condition, the score would keep increasing
									this.enemyPos.h = true;
									this.playerCollided = true;
									if(this.resultString=='player_1hit'){this.resultString = '2hit';}
									else{this.resultString='enemy_1hit'}
								}
								//enemyMissile - enemy
								if(abs(this.enemyMissilePos.x-this.enemyPos.x)<10 && abs(this.enemyMissilePos.y-this.enemyPos.y)<10){
									
									if(!this.enemyCollided){this.score[0] += 1; ui.sfxs['HIT'].play();}
									this.enemyPos.h = true;
									this.enemyCollided = true;
									if(this.resultString=='player_1hit'){this.resultString = '2hit';}
									else{this.resultString='enemy_1hit'}
								}
								//enemyMissile - player
								if(abs(this.enemyMissilePos.x-this.playerPos.x)<10 && abs(this.enemyMissilePos.y-this.playerPos.y)<10){
									
									if(!this.enemyCollided){this.score[1] += 1; ui.sfxs['HIT'].play();}
									this.playerPos.h = true;
									this.enemyCollided = true;
									if(this.resultString=='enemy_1hit'){this.resultString = '2hit';}
									else{this.resultString='player_1hit'}
								}
								//playerMissile - player
								if(abs(this.playerMissilePos.x-this.playerPos.x)<10 && abs(this.playerMissilePos.y-this.playerPos.y)<10){
									
									if(!this.playerCollided){this.score[1] += 1; ui.sfxs['HIT'].play();}
									this.playerPos.h = true;
									this.playerCollided = true;
									if(this.resultString=='enemy_1hit'){this.resultString = '2hit';}
									else{this.resultString='player_1hit'}
								}
								
								//playerMissile - planets
								for(let i=0; i<this.planets.length; i++){
									if(abs(this.playerMissilePos.x-this.planets[i].x)<10+4*this.planets[i].m && abs(this.playerMissilePos.y-this.planets[i].y)<10+4*this.planets[i].m){
										if(!this.playerCollided){this.planets[i].h += 1; ui.sfxs['HIT'].play();}
										this.playerCollided = true;
										if(this.resultString==''){this.resultString = 'miss';}
									}
								}
								//enemyMissile - planets
								for(let i=0; i<this.planets.length; i++){
									if(abs(this.enemyMissilePos.x-this.planets[i].x)<10+4*this.planets[i].m && abs(this.enemyMissilePos.y-this.planets[i].y)<10+4*this.planets[i].m){
										if(!this.enemyCollided){this.planets[i].h += 1; ui.sfxs['HIT'].play();}
										this.enemyCollided = true;
										if(this.resultString==''){this.resultString = 'miss';}
									}
								}
								
								if(ui.frameCount > 15*window.fps){
									if(!this.playerCollided && !this.enemyCollided){this.resultString = 'miss';}
									this.playerCollided = true;
									this.enemyCollided = true;
								}
								
								if(this.playerCollided && this.enemyCollided){
									this.gameSubState = 'collided';
									if(this.resultString.slice(-3)=='hit'){this.resultString=this.resultString.slice(-4);}
									ui.frameCount = 0;
								}
							}
					
							break;
							
						case 'collided':
							if(ui.frameCount>3*window.fps){
								this.playerCollided = false;
								this.enemyCollided = false;
								
								if(this.score[0] >= 5 && this.score[1] >= 5){
									this.gameSubState = 'draw';
								}
								else if(this.score[0] >= 5){
									this.gameSubState = 'win';
								}
								else if(this.score[1] >= 5){
									this.gameSubState = 'lose';
								}
								else{
									this.resetStuff('shot');
									document.getElementById('fireRange').style.visibility = 'visible';
									document.getElementById('fireButton').disabled = false;
									this.gameSubState = 'ready';
									ui.frameCount = 0;
									if(this.resultString=='1hit' || this.resultString=='2hit'){this.readyFadeIn();}
								}
							}
			
							break;
					}
										
					break;
				
				case 'gameover':
					this.justStartedPlaying = true;
					break;
				
				case 'escmenu':
					break;
			}
			if (this.onUpdate) this.onUpdate(this);
			
		}
		
		keyHandling(ekeys) {
		if(document.getElementById('chat-input') !== document.activeElement){ //eg: spacebar is generally used to 'confirm' game action. but when text cursor is in chat input, spacebar should only type a space. etc.
			if(ekeys['z']){
				window.scale = window.scale==1?2:1;
				gameCanvas.width = window.scale*window.width;
				gameCanvas.height = window.scale*window.height;
				ui.ctx.imageSmoothingEnabled = false;
				ui.ctx.scale(window.scale, window.scale);
				resizeSlider();
				canvasContainer.style.height = gameCanvas.height + document.getElementById('fireDiv').offsetHeight; //there has to be a css way to do this???
				let lobbyList = document.getElementById('lobbyList');
				let newLobbyListStyle = window.scale==2 ? 'position:relative; font-size:26px; left:46px; top:212px; width:364px; height:180px' : 'position:relative; font-size:13px; left:23px; top:106px; width:182px; height:90px';
				newLobbyListStyle = 'visibility:' + (this.gameState=='lobby'?'visible':'hidden') + '; ' + newLobbyListStyle;
				lobbyList.style = newLobbyListStyle;
				document.getElementById('chat-list').style.height = gameCanvas.height;
				emojiInit(window.scale);
				
				ekeys['z'] = false;
			}
			if(ekeys['Escape']){
				if(this.gameState != 'escmenu' && this.gameMode != 2){ //can't pause when already paused, and can't pause online games
					window.audioContext.suspend();
					this.resumeFrame = ui.frameCount;
					this.gameState = 'escmenu';
					ekeys['Escape'] = false;
				}
			}
			switch(this.gameState){
				case 'loading':
					if(ekeys[' ']){
						ekeys[' ']=false;
						this.gameState = 'startscreen';
						this.gameSubState = 'null';
						this.previousGameState = 'startscreen';
						ui.startscreenAnim = Math.floor(2*Math.random());
						this.readyFadeIn();
					}
					break;
				case 'startscreen':
					if(ekeys['ArrowUp']){
						this.gameMode = (this.gameMode + this.numGameModes-1)%this.numGameModes; //+3-1 because just doing -1 leads to negative results for the modulo function
						ui.sfxs['SELECT'].play();
						ekeys['ArrowUp'] = false;
					}
					if(ekeys['ArrowDown']){
						this.gameMode = (this.gameMode + 1)%this.numGameModes;
						ui.sfxs['SELECT'].play();
						ekeys['ArrowDown'] = false;
					}
					if(ekeys[' ']){
						ekeys[' ']=false;
						this.resetStuff('gameover');
						window.audioContext.resume();
						ui.sfxs['OK'].play();
						if(this.gameMode != 2){
							this.gameState = 'playing';
							this.gameSubState = this.gameMode!=3 ? 'ready' : 1;
							this.previousGameState = 'playing';
							this.readyFadeIn(); //fade-in animation
						}
						else if(this.gameMode == 2){
							let input = null;
							if(socket != null){
								input = window.prompt(ui.strEnterName);
								if(input != null && input != "" ){ //if they don't enter anything, don't take them to the lobby
									this.playerName = input.substring(0,12); //names are capped at 12 characters to fit in the column in the lobby
									this.gameState = 'lobby';
									this.previousGameState = 'lobby';
									socket.emit('reload event', null); //to display available hosts as soon as you enter lobby (pretend you entered and immediately hit reload)
									document.getElementById('lobbyList').style.visibility = 'visible';
									this.readyFadeIn(); //fade-in animation
								}
							}
							else{
								window.alert(ui.strSocketError);
							}
						}
					}
					break;
				
				case 'lobby':
					//actions in the lobby for now are mostly mouse-based, so are handled in a clickhandling function in akantares-index.html
					break;
				
				case 'playing':
				
					// if(ekeys['k']){ //debug cheat, remove when finished!!
						// this.score[0]++;
						// ekeys['k'] = false;
					// }
					
					if(this.gameSubState == 'ready'){
						if(ekeys['ArrowLeft']){
							if((this.gameMode==0) || (this.gameMode==1 && this.whoseTurn == 0) || (this.gameMode==2 && this.playerType=='host' && this.disabled==false)){
								this.playerAngle -= (3-2*ekeys['Shift']); //holding shift for finer control
								document.getElementById('fireRange').value = (this.playerAngle+360)%360; //periodic boundary conditions as the slider represents an azimuthal angle
							}
							else if((this.gameMode==1 && this.whoseTurn == 1) || (this.gameMode==2 && this.playerType=='guest' && this.disabled==false)){
								this.enemyAngle -= (3-2*ekeys['Shift']);
								document.getElementById('fireRange').value = (this.enemyAngle+360)%360;
							}
						}
						if(ekeys['ArrowRight']){
							if((this.gameMode==0) || (this.gameMode==1 && this.whoseTurn == 0) || (this.gameMode==2 && this.playerType=='host' && this.disabled==false)){
								this.playerAngle -= -(3-2*ekeys['Shift']); //using += 1 instantly slides it all the way to max. why the heck?
								document.getElementById('fireRange').value = (this.playerAngle+360)%360;
							}
							else if((this.gameMode==1 && this.whoseTurn == 1) || (this.gameMode==2 && this.playerType=='guest' && this.disabled==false)){
								this.enemyAngle -= -(3-2*ekeys['Shift']);
								document.getElementById('fireRange').value = (this.enemyAngle+360)%360;
							}
						}
						if(ekeys[' ']){
							this.fire();
							ekeys[' '] = false;
						}
					}
					
					if(this.gameSubState == 'win' || this.gameSubState == 'lose' || this.gameSubState =='draw'){
						if(ekeys[' ']){
							ui.sfxs['OK'].play();
							if(this.gameMode != 2){
								this.resetStuff('gameover');
								this.gameState = 'playing';
								this.gameSubState = 'ready';
								this.previousGameState = 'playing';
								document.getElementById('fireRange').style.visibility = 'visible';
								this.readyFadeIn();
							}
							if(this.gameMode == 2){
								ui.frameCount = 0;
								this.rematchChoiceMade = this.rematchChoice;
								this.rematch[this.playerType] = this.rematchChoiceMade;
								socket.emit('rematch event', {hostID:this.myHostID, playerType:this.playerType, msg:this.rematchChoiceMade});
								if(this.rematchChoice == 0){ //copied from restart game code. if we choose not to rematch, we basically disconnect and reset to title screen
									socket.disconnect();
									ui.stop_bgm();
									window.audioContext.resume();
									this.gameState = 'startscreen';
									this.previousGameState = 'startscreen';
								}
							}
							ekeys[' '] = false;
						}
						if(ekeys['ArrowUp'] && this.rematchChoiceMade==null){
							this.rematchChoice = 1-this.rematchChoice;
							ui.sfxs['SELECT'].play();
							ekeys['ArrowUp'] = false;
						}
						if(ekeys['ArrowDown'] && this.rematchChoiceMade==null){
							this.rematchChoice = 1-this.rematchChoice;
							ui.sfxs['SELECT'].play();
							ekeys['ArrowDown'] = false;
						}
					}
					
					if(this.gameMode==3 && this.gameSubState<this.numInstructions){
						if(ekeys[' ']){
							ui.sfxs['OK'].play();
							this.gameSubState++;
							ekeys[' '] = false;
							this.readyFadeIn();
						}
					}
					if(this.gameSubState == this.numInstructions){
						if(ekeys[' ']){
							ui.sfxs['OK'].play();
							this.gameState = 'startscreen';
							this.previousGameState = 'startscreen';
							ekeys[' '] = false;
							document.getElementById('fireDiv').style.opacity = 0;
							this.readyFadeIn();
						}
					}
					
					break;
				
				case 'gameover':
					if(ekeys[' ']){
						this.resetStuff('gameover');
						this.gameState = 'playing';
						this.previousGameState = 'playing';
					}
					break;
				
				case 'escmenu':
					if(ekeys['f']){
						window.audioContext.resume();
						ui.frameCount = this.resumeFrame;
						this.gameState = this.previousGameState;
					}
					if(ekeys['g']){
						ui.frameCount = 0;
						ui.stop_bgm();
						window.audioContext.resume();
						this.gameState = 'loading';
						this.previousGameState = 'loading';
						document.getElementById('fireRange').style.visibility = 'visible';
						document.getElementById('fireButton').disabled = false;
						document.getElementById('fireDiv').style.opacity = 0;
						this.readyFadeIn;
					}
					if(ekeys['h']){
						this.help = !this.help;
						ekeys['h'] = false;
					}
					break;
			}
		}
		}
		
	}
	
	window.Game = Game;
})();