// Retro Brick Game Console Engine supporting Tetris and Tank Battle
const COLS = 10;
const ROWS = 20;

let grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
let nextGrid = Array(4).fill(null).map(() => Array(4).fill(0));

let score = 0;
let hiScore = localStorage.getItem('brick_hiscore') || 0;
let level = 1;
let speed = 1;
let isPaused = false;
let isGameOver = false;
let soundOn = true;
let activeGame = 'TETRIS'; // 'TETRIS' or 'TANK'

// Audio Beep generator
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, duration, type = 'square') {
    if (!soundOn || !audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
}

// DOM Elements
const gridEl = document.getElementById('lcd-grid');
const nextEl = document.getElementById('next-grid');
const scoreEl = document.getElementById('score-val');
const hiScoreEl = document.getElementById('hi-score-val');
const levelEl = document.getElementById('level-val');
const speedEl = document.getElementById('speed-val');
const iconPause = document.getElementById('icon-pause');
const iconSound = document.getElementById('icon-sound');

function initGridDOM(element, r, c) {
    element.innerHTML = '';
    for (let i = 0; i < r; i++) {
        for (let j = 0; j < c; j++) {
            const pix = document.createElement('div');
            pix.className = 'pixel';
            pix.id = `pix-${i}-${j}`;
            element.appendChild(pix);
        }
    }
}

initGridDOM(gridEl, ROWS, COLS);
initGridDOM(nextEl, 4, 4);

// --- TANK GAME STATE ---
let tankGame = null;

class TankGame {
    constructor() {
        this.player = { x: 4, y: 17, dir: 'UP' };
        this.bullets = [];
        this.enemies = [
            { x: 1, y: 1, dir: 'DOWN', shootTimer: 0 },
            { x: 4, y: 1, dir: 'DOWN', shootTimer: 0 },
            { x: 7, y: 1, dir: 'DOWN', shootTimer: 0 }
        ];
        this.walls = [
            {x: 2, y: 8}, {x: 3, y: 8}, {x: 6, y: 8}, {x: 7, y: 8},
            {x: 2, y: 13}, {x: 7, y: 13}
        ];
        this.enemyBullets = [];
        this.tickCount = 0;
    }

    update() {
        if (isPaused || isGameOver) return;
        this.tickCount++;
        
        // Move bullets
        this.bullets.forEach(b => {
            if (b.dir === 'UP') b.y--;
            if (b.dir === 'DOWN') b.y++;
            if (b.dir === 'LEFT') b.x--;
            if (b.dir === 'RIGHT') b.x++;
        });

        this.enemyBullets.forEach(b => {
            if (b.dir === 'UP') b.y--;
            if (b.dir === 'DOWN') b.y++;
            if (b.dir === 'LEFT') b.x--;
            if (b.dir === 'RIGHT') b.x++;
        });

        // Collision: Player bullets vs walls & enemies
        this.bullets = this.bullets.filter(b => {
            if (b.x < 0 || b.x >= COLS || b.y < 0 || b.y >= ROWS) return false;
            // Hit wall
            let hitWall = this.walls.findIndex(w => w.x === b.x && w.y === b.y);
            if (hitWall !== -1) {
                this.walls.splice(hitWall, 1);
                playTone(150, 0.05);
                return false;
            }
            // Hit enemy
            let hitEnemy = this.enemies.findIndex(e => Math.abs(e.x - b.x) <= 1 && Math.abs(e.y - b.y) <= 1);
            if (hitEnemy !== -1) {
                this.enemies.splice(hitEnemy, 1);
                score += 100;
                playTone(600, 0.1);
                if (this.enemies.length === 0) {
                    level++;
                    this.spawnEnemies();
                }
                return false;
            }
            return true;
        });

        // Collision: Enemy bullets vs player
        this.enemyBullets = this.enemyBullets.filter(b => {
            if (b.x < 0 || b.x >= COLS || b.y < 0 || b.y >= ROWS) return false;
            if (Math.abs(this.player.x - b.x) <= 1 && Math.abs(this.player.y - b.y) <= 1) {
                isGameOver = true;
                playTone(80, 0.4);
                return false;
            }
            return true;
        });

        // Enemy AI behavior
        if (this.tickCount % Math.max(10, 30 - level * 3) === 0) {
            this.enemies.forEach(e => {
                // Simple move toward player or random
                let dirs = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
                e.dir = dirs[Math.floor(Math.random() * dirs.length)];
                if (e.dir === 'UP' && e.y > 1) e.y--;
                if (e.dir === 'DOWN' && e.y < ROWS - 2) e.y++;
                if (e.dir === 'LEFT' && e.x > 0) e.x--;
                if (e.dir === 'RIGHT' && e.x < COLS - 1) e.x++;

                // Enemy shoot
                if (Math.random() < 0.4) {
                    this.enemyBullets.push({ x: e.x, y: e.y + 1, dir: 'DOWN' });
                }
            });
        }
    }

    spawnEnemies() {
        let count = Math.min(6, 3 + level);
        this.enemies = [];
        for (let i = 0; i < count; i++) {
            this.enemies.push({
                x: Math.floor(Math.random() * (COLS - 2)),
                y: 1,
                dir: 'DOWN'
            });
        }
    }

    render() {
        // Clear grid
        let displayGrid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
        
        // Draw walls
        this.walls.forEach(w => {
            if (w.y >= 0 && w.y < ROWS && w.x >= 0 && w.x < COLS) {
                displayGrid[w.y][w.x] = 1;
            }
        });

        // Draw player tank (3x2 pixels)
        let px = this.player.x, py = this.player.y;
        for (let dy = -1; dy <= 0; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (py + dy >= 0 && py + dy < ROWS && px + dx >= 0 && px + dx < COLS) {
                    displayGrid[py + dy][px + dx] = 1;
                }
            }
        }

        // Draw enemies
        this.enemies.forEach(e => {
            let ex = e.x, ey = e.y;
            for (let dy = 0; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (ey + dy >= 0 && ey + dy < ROWS && ex + dx >= 0 && ex + dx < COLS) {
                        displayGrid[ey + dy][ex + dx] = 1;
                    }
                }
            }
        });

        // Draw bullets
        this.bullets.forEach(b => {
            if (b.y >= 0 && b.y < ROWS && b.x >= 0 && b.x < COLS) displayGrid[b.y][b.x] = 1;
        });
        this.enemyBullets.forEach(b => {
            if (b.y >= 0 && b.y < ROWS && b.x >= 0 && b.x < COLS) displayGrid[b.y][b.x] = 1;
        });

        // Render to DOM
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const pix = document.getElementById(`pix-${r}-${c}`);
                if (pix) {
                    if (displayGrid[r][c]) pix.classList.add('active');
                    else pix.classList.remove('active');
                }
            }
        }
    }

    handleInput(key) {
        if (isGameOver || isPaused) return;
        if (key === 'LEFT') { this.player.dir = 'LEFT'; if (this.player.x > 1) this.player.x--; }
        if (key === 'RIGHT') { this.player.dir = 'RIGHT'; if (this.player.x < COLS - 2) this.player.x++; }
        if (key === 'UP') { this.player.dir = 'UP'; if (this.player.y > 1) this.player.y--; }
        if (key === 'DOWN') { this.player.dir = 'DOWN'; if (this.player.y < ROWS - 1) this.player.y++; }
        if (key === 'FIRE') {
            this.bullets.push({ x: this.player.x, y: this.player.y - 2, dir: 'UP' });
            playTone(400, 0.05);
        }
    }
}

// --- TETRIS GAME STATE (Fallback/Original) ---
const TETROMINOES = {
    I: [[1,1,1,1]],
    J: [[1,0,0],[1,1,1]],
    L: [[0,0,1],[1,1,1]],
    O: [[1,1],[1,1]],
    S: [[0,1,1],[1,1,0]],
    T: [[0,1,0],[1,1,1]],
    Z: [[1,1,0],[0,1,1]]
};

let currentPiece = null;
let currentX = 0, currentY = 0;

function spawnTetrisPiece() {
    const keys = Object.keys(TETROMINOES);
    const type = keys[Math.floor(Math.random() * keys.length)];
    currentPiece = TETROMINOES[type];
    currentX = Math.floor((COLS - currentPiece[0].length) / 2);
    currentY = 0;
    if (checkTetrisCollision(currentX, currentY, currentPiece)) {
        isGameOver = true;
        playTone(100, 0.5);
    }
}

function checkTetrisCollision(x, y, piece) {
    for (let r = 0; r < piece.length; r++) {
        for (let c = 0; c < piece[r].length; c++) {
            if (piece[r][c]) {
                let newX = x + c;
                let newY = y + r;
                if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
                if (newY >= 0 && grid[newY][newX]) return true;
            }
        }
    }
    return false;
}

function mergeTetrisPiece() {
    for (let r = 0; r < currentPiece.length; r++) {
        for (let c = 0; c < currentPiece[r].length; c++) {
            if (currentPiece[r][c] && currentY + r >= 0) {
                grid[currentY + r][currentX + c] = 1;
            }
        }
    }
}

function clearLines() {
    let linesCleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r].every(cell => cell === 1)) {
            grid.splice(r, 1);
            grid.unshift(Array(COLS).fill(0));
            linesCleared++;
            r++;
        }
    }
    if (linesCleared > 0) {
        score += linesCleared * 100 * level;
        playTone(500, 0.15);
    }
}

// Main Loop
function update() {
    if (isPaused || isGameOver) return;

    if (activeGame === 'TANK') {
        tankGame.update();
        tankGame.render();
    } else {
        // Tetris update
        currentY++;
        if (checkTetrisCollision(currentX, currentY, currentPiece)) {
            currentY--;
            mergeTetrisPiece();
            clearLines();
            spawnTetrisPiece();
        }
        renderTetris();
    }

    scoreEl.innerText = String(score).padStart(6, '0');
    if (score > hiScore) {
        hiScore = score;
        localStorage.setItem('brick_hiscore', hiScore);
    }
    hiScoreEl.innerText = String(hiScore).padStart(6, '0');
    levelEl.innerText = String(level).padStart(2, '0');
    speedEl.innerText = String(speed).padStart(2, '0');
}

function renderTetris() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const pix = document.getElementById(`pix-${r}-${c}`);
            if (pix) {
                let active = grid[r][c];
                if (currentPiece) {
                    let pr = r - currentY;
                    let pc = c - currentX;
                    if (pr >= 0 && pr < currentPiece.length && pc >= 0 && pc < currentPiece[pr].length) {
                        if (currentPiece[pr][pc]) active = 1;
                    }
                }
                if (active) pix.classList.add('active');
                else pix.classList.remove('active');
            }
        }
    }
}

// Controls
function handleInput(dir) {
    if (isGameOver) return;
    if (activeGame === 'TANK') {
        tankGame.handleInput(dir);
        return;
    }

    if (dir === 'LEFT' && !checkTetrisCollision(currentX - 1, currentY, currentPiece)) currentX--;
    if (dir === 'RIGHT' && !checkTetrisCollision(currentX + 1, currentY, currentPiece)) currentX++;
    if (dir === 'DOWN' && !checkTetrisCollision(currentX, currentY + 1, currentPiece)) { currentY++; score += 1; }
    if (dir === 'FIRE' || dir === 'ROTATE') {
        // Rotate piece
        const rotated = currentPiece[0].map((_, index) => currentPiece.map(row => row[index]).reverse());
        if (!checkTetrisCollision(currentX, currentY, rotated)) {
            currentPiece = rotated;
            playTone(300, 0.05);
        }
    }
    renderTetris();
}

// Button Event Listeners
document.getElementById('btn-left').addEventListener('click', () => handleInput('LEFT'));
document.getElementById('btn-right').addEventListener('click', () => handleInput('RIGHT'));
document.getElementById('btn-down').addEventListener('click', () => handleInput('DOWN'));
document.getElementById('btn-up')?.addEventListener('click', () => handleInput('UP'));
document.getElementById('btn-rotate').addEventListener('click', () => handleInput('FIRE'));

document.getElementById('btn-sp').addEventListener('click', () => {
    // Switch between TETRIS and TANK
    activeGame = activeGame === 'TETRIS' ? 'TANK' : 'TETRIS';
    resetGame();
    playTone(450, 0.1);
});

document.getElementById('btn-sound').addEventListener('click', () => {
    soundOn = !soundOn;
    iconSound.innerText = soundOn ? '🔊' : '🔇';
});

document.getElementById('btn-reset').addEventListener('click', () => {
    resetGame();
    playTone(250, 0.2);
});

function resetGame() {
    score = 0;
    level = 1;
    speed = 1;
    isGameOver = false;
    isPaused = false;
    iconPause.classList.add('off');
    grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    if (activeGame === 'TANK') {
        tankGame = new TankGame();
    } else {
        spawnTetrisPiece();
    }
}

// Start
resetGame();
setInterval(update, 300);
