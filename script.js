/*
  Mini Car Racing
  - Separate HTML/CSS/JS
  - Keyboard: ArrowLeft/ArrowRight, ArrowUp (accelerate), ArrowDown (brake)
  - Start/Pause/Restart buttons
  - Simple obstacle spawning and collision detection
*/

(() => {
  // Canvas setup
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // HUD elements
  const scoreEl = document.getElementById('score');
  const speedEl = document.getElementById('speed');
  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');
  const btnRestart = document.getElementById('btnRestart');

  // Game constants
  const GAME_WIDTH = 480;
  const GAME_HEIGHT = 720;
  const LANE_COUNT = 3;
  const LANE_WIDTH = GAME_WIDTH / LANE_COUNT;
  const PLAYER_WIDTH = 48;
  const PLAYER_HEIGHT = 80;
  const OBSTACLE_WIDTH = 48;
  const OBSTACLE_HEIGHT = 80;

  // Game state
  let running = false;
  let paused = false;
  let lastTime = 0;
  let spawnTimer = 0;
  let spawnInterval = 1200; // ms
  let speed = 4; // base speed units
  let score = 0;

  // Input
  const keys = { left:false, right:false, up:false, down:false };

  // Player
  const player = {
    lane: 1, // 0..LANE_COUNT-1 (center start)
    x: (LANE_WIDTH * 1) + (LANE_WIDTH - PLAYER_WIDTH)/2,
    y: GAME_HEIGHT - PLAYER_HEIGHT - 24,
    w: PLAYER_WIDTH,
    h: PLAYER_HEIGHT,
    vx: 0,
    maxSteer: 8
  };

  // Obstacles array
  const obstacles = [];

  // Resize canvas to fixed logical size but responsive in CSS (we use internal coords)
  function resetCanvasSize(){
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    // recalc player x based on lane
    player.x = laneToX(player.lane);
  }

  function laneToX(lane){
    return lane * LANE_WIDTH + (LANE_WIDTH - PLAYER_WIDTH) / 2;
  }

  // Utility: random int
  const randInt = (min,max) => Math.floor(Math.random()*(max-min+1))+min;

  // Spawn an obstacle in a random lane
  function spawnObstacle(){
    const lane = randInt(0, LANE_COUNT-1);
    const x = laneToX(lane);
    const y = -OBSTACLE_HEIGHT - randInt(0,80);
    const speedFactor = 0.9 + Math.random()*0.6;
    obstacles.push({x,y,w:OBSTACLE_WIDTH,h:OBSTACLE_HEIGHT,lane, speedFactor});
  }

  // Input handlers
  window.addEventListener('keydown', e => {
    if(e.code === 'ArrowLeft') keys.left = true;
    if(e.code === 'ArrowRight') keys.right = true;
    if(e.code === 'ArrowUp') keys.up = true;
    if(e.code === 'ArrowDown') keys.down = true;
    // Quick controls
    if(e.code === 'Space') togglePause();
  });
  window.addEventListener('keyup', e => {
    if(e.code === 'ArrowLeft') keys.left = false;
    if(e.code === 'ArrowRight') keys.right = false;
    if(e.code === 'ArrowUp') keys.up = false;
    if(e.code === 'ArrowDown') keys.down = false;
  });

  // Buttons
  btnStart.addEventListener('click', startGame);
  btnPause.addEventListener('click', togglePause);
  btnRestart.addEventListener('click', restartGame);

  // Start / Pause / Restart
  function startGame(){
    if(!running){
      running = true;
      paused = false;
      lastTime = performance.now();
      spawnTimer = 0;
      requestAnimationFrame(loop);
    }
  }

  function togglePause(){
    if(!running) return;
    paused = !paused;
    btnPause.textContent = paused ? 'Resume' : 'Pause';
    if(!paused){
      lastTime = performance.now();
      requestAnimationFrame(loop);
    }
  }

  function restartGame(){
    running = true;
    paused = false;
    obstacles.length = 0;
    score = 0;
    speed = 4;
    player.lane = 1;
    player.x = laneToX(player.lane);
    spawnTimer = 0;
    btnPause.textContent = 'Pause';
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  // Collision check (AABB)
  function collides(a,b){
    return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
  }

  // Game loop
  function loop(now){
    if(!running || paused) return;
    const dt = Math.min(40, now - lastTime); // ms, clamp to avoid jumpiness
    lastTime = now;

    update(dt);
    render();

    if(running && !paused) requestAnimationFrame(loop);
  }

  // Update game state
  function update(dt){
    // Controls: steering changes lane smoothly
    if(keys.left){
      player.vx = Math.max(player.vx - 0.8, -player.maxSteer);
    } else if(keys.right){
      player.vx = Math.min(player.vx + 0.8, player.maxSteer);
    } else {
      // friction to center velocity
      player.vx *= 0.8;
      if(Math.abs(player.vx) < 0.2) player.vx = 0;
    }

    // Apply steering to x, and keep within track
    player.x += player.vx;
    const minX = 6, maxX = GAME_WIDTH - PLAYER_WIDTH - 6;
    if(player.x < minX) player.x = minX;
    if(player.x > maxX) player.x = maxX;

    // Speed control
    if(keys.up) speed = Math.min(14, speed + 0.02 * dt);
    if(keys.down) speed = Math.max(2, speed - 0.03 * dt);
    // passive slight slow drift
    speed = Math.max(2, speed - 0.001 * dt);

    // Obstacles movement
    for(let i = obstacles.length-1; i >= 0; --i){
      const ob = obstacles[i];
      ob.y += (speed * ob.speedFactor) * (dt / 16); // scale by dt
      // remove offscreen
      if(ob.y > GAME_HEIGHT + 50){
        obstacles.splice(i,1);
        score += 10; // reward for passing
      }
      // collision check with player
      const pbox = {x: player.x, y: player.y, w: player.w, h: player.h};
      if(collides(pbox, ob)){
        // game over
        running = false;
        setTimeout(()=> {
          alert('Crashed! Score: ' + Math.floor(score));
          restartGame();
        }, 10);
        return;
      }
    }

    // Spawn logic
    spawnTimer += dt;
    if(spawnTimer > spawnInterval){
      spawnTimer = 0;
      spawnInterval = Math.max(650, 1200 - Math.floor(score/100) * 40); // faster as you score
      spawnObstacle();
    }

    // Increase score gradually
    score += (speed*0.02) * (dt/16);
    // Update HUD
    scoreEl.textContent = 'Score: ' + Math.floor(score);
    speedEl.textContent = 'Speed: ' + Math.floor(speed);
  }

  // Render
  function render(){
    // clear
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // draw road background
    drawRoad();

    // draw obstacles (other cars)
    for(const ob of obstacles){
      drawCar(ob.x, ob.y, ob.w, ob.h, '#d23f3f', true);
    }

    // draw player car
    drawCar(player.x, player.y, player.w, player.h, '#2ad24a', false);

    // draw HUD overlay (center)
    ctx.save();
    ctx.font = '14px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(12,12,110,30);
    ctx.restore();
  }

  // draw road, lanes and perspective lines
  function drawRoad(){
    // road background
    const rpad = 12;
    const roadX = rpad, roadY = 0, roadW = GAME_WIDTH - rpad*2, roadH = GAME_HEIGHT;
    // road fill
    ctx.fillStyle = '#111827';
    ctx.fillRect(roadX, roadY, roadW, roadH);

    // lane markers (dashed)
    const laneGap = roadW / LANE_COUNT;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 14]);
    for(let i=1;i<LANE_COUNT;i++){
      const lx = roadX + i*laneGap;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, roadH);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // road border
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 2;
    ctx.strokeRect(roadX,roadY,roadW,roadH);
  }

  // Draw a simple car rectangle with a windshield and wheels
  function drawCar(x,y,w,h,color, flipped=false){
    ctx.save();
    ctx.translate(x,y);
    // body
    ctx.fillStyle = color;
    roundRect(ctx, 0, 0, w, h, 6, true, false);

    // windshield
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(w*0.18, h*0.12, w*0.64, h*0.28);

    // wheels
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    const wheelW = w*0.18, wheelH = h*0.12;
    ctx.fillRect(w*0.08, h - wheelH/1.2, wheelW, wheelH);
    ctx.fillRect(w - w*0.08 - wheelW, h - wheelH/1.2, wheelW, wheelH);

    // head/tail lights
    ctx.fillStyle = (flipped ? '#ffd4d4' : '#ffe16b');
    ctx.fillRect(w*0.02, h*0.36, w*0.06, h*0.12);
    ctx.fillRect(w - w*0.02 - w*0.06, h*0.36, w*0.06, h*0.12);

    ctx.restore();
  }

  // small helper to draw rounded rect
  function roundRect(ctx, x, y, w, h, r, fill, stroke){
    if (typeof r === 'undefined') r = 5;
    if (typeof stroke === 'undefined') stroke = true;
    if (typeof fill === 'undefined') fill = true;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // initial setup
  resetCanvasSize();
  // show initial instruction
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('Click Start to play', canvas.width/2, canvas.height/2 - 10);
  ctx.font = '12px system-ui';
  ctx.fillText('Use ← → ↑ ↓ keys to control', canvas.width/2, canvas.height/2 + 18);

  // Expose restart to console for testing
  window.__miniRacing = { restart: restartGame, start: startGame };
})();
