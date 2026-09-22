class BrickGameConsole {
    constructor() {
        this.width = 10;
        this.height = 20;
        this.grid = Array(this.height).fill(0).map(() => Array(this.width).fill(0));
        this.score = 0;
        this.hiScore = parseInt(localStorage.getItem('brick_hiscore') || '0', 10);
        this.level = 1;
        this.speed = 1;
        this.lives = 0;

        this.isRunning = false;
        this.isPaused = false;
        this.isGameOver = false;
        this.soundEnabled = true;
        this.currentMode = 'MENU'; // MENU, BLOCK, TANK, RACE, SNAKE, BREAKOUT
        this.menuIndex = 0;
        this.menuItems = [
            { id: 'BLOCK', name: '01 BLOCK' },
            { id: 'TANK', name: '02 TANK' },
            { id: 'RACE', name: '03 RACE' },
            { id: 'SNAKE', name: '04 SNAKE' },
            { id: 'BREAKOUT', name: '05 BREAKOUT' }
        ];

        // Per-mode difficulty curve: tick interval (ms) shrinks as level rises.
        this.modeConfig = {
            BLOCK:     { base: 500, min: 120, step: 35 },
            TANK:      { base: 160, min: 80,  step: 10 },
            RACE:      { base: 160, min: 80,  step: 12 },
            SNAKE:     { base: 220, min: 90,  step: 12 },
            BREAKOUT:  { base: 110, min: 55,  step: 6 }
        };

        this.timer = null;
        this.tickInterval = 150;

        // Game specific state
        this.gameState = {};

        this.initAudio();
        this.initDOM();
        this.bindEvents();
        this.renderMenu();
    }

    initAudio() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        } catch (e) {
            this.audioCtx = null;
        }
    }

    playSound(type) {
        if (!this.soundEnabled || !this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            const now = this.audioCtx.currentTime;

            if (type === 'beep') {
                osc.frequency.setValueAtTime(440, now);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
                osc.start(now);
                osc.stop(now + 0.05);
            } else if (type === 'hit') {
                osc.frequency.setValueAtTime(700, now);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'hurt') {
                osc.frequency.setValueAtTime(180, now);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (type === 'levelup') {
                osc.frequency.setValueAtTime(392, now);
                osc.frequency.setValueAtTime(523.25, now + 0.1);
                osc.frequency.setValueAtTime(659.25, now + 0.2);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.32);
                osc.start(now);
                osc.stop(now + 0.32);
            } else if (type === 'start') {
                osc.frequency.setValueAtTime(261.63, now);
                osc.frequency.setValueAtTime(329.63, now + 0.1);
                osc.frequency.setValueAtTime(392.00, now + 0.2);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
            } else if (type === 'gameover') {
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.linearRampToValueAtTime(100, now + 0.4);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
                osc.start(now);
                osc.stop(now + 0.4);
            }
        } catch (e) {}
    }

    initDOM() {
        const gridEl = document.getElementById('lcd-grid');
        gridEl.innerHTML = '';
        this.pixels = [];
        for (let r = 0; r < this.height; r++) {
            this.pixels[r] = [];
            for (let c = 0; c < this.width; c++) {
                const pixel = document.createElement('div');
                pixel.className = 'pixel';
                gridEl.appendChild(pixel);
                this.pixels[r][c] = pixel;
            }
        }
        this.updateStats();
    }

    // Centralised score handling so hi-score always stays correct across every game.
    addScore(points) {
        this.score += points;
        if (this.score > this.hiScore) {
            this.hiScore = this.score;
            localStorage.setItem('brick_hiscore', this.hiScore);
        }
    }

    // Recompute this.tickInterval from the current mode + level, and restart the
    // running timer immediately so speed-ups take effect without lag.
    applySpeedForLevel() {
        const cfg = this.modeConfig[this.currentMode];
        if (cfg) {
            this.tickInterval = Math.max(cfg.min, cfg.base - (this.level - 1) * cfg.step);
        }
        this.speed = this.level;
        if (this.isRunning && this.timer) {
            clearInterval(this.timer);
            this.timer = setInterval(() => this.gameLoop(), this.tickInterval);
        }
    }

    levelUpTo(newLevel) {
        if (newLevel > this.level) {
            this.level = newLevel;
            this.playSound('levelup');
            this.applySpeedForLevel();
        }
    }

    updateTitle() {
        const el = document.getElementById('lcd-title');
        if (this.currentMode === 'MENU' || this.currentMode === 'GAME OVER') return;
        el.textContent = this.lives > 0 ? `${this.currentMode} ${'\u2665'.repeat(this.lives)}` : this.currentMode;
    }

    updateStats() {
        document.getElementById('score-val').textContent = String(this.score).padStart(6, '0');
        document.getElementById('hi-score-val').textContent = String(this.hiScore).padStart(6, '0');
        document.getElementById('level-val').textContent = String(this.level).padStart(2, '0');
        document.getElementById('speed-val').textContent = String(this.speed).padStart(2, '0');
        document.getElementById('icon-sound').style.opacity = this.soundEnabled ? '1' : '0.2';
        document.getElementById('icon-pause').className = this.isPaused ? '' : 'off';
    }

    renderGrid() {
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
                if (this.grid[r][c]) {
                    this.pixels[r][c].classList.add('on');
                } else {
                    this.pixels[r][c].classList.remove('on');
                }
            }
        }
    }

    clearGrid() {
        this.grid = Array(this.height).fill(0).map(() => Array(this.width).fill(0));
    }

    renderMenu() {
        this.clearGrid();
        document.getElementById('lcd-title').textContent = `MENU: ${this.menuItems[this.menuIndex].name}`;
        // Render menu text or items on grid
        const startRow = 6;
        this.menuItems.forEach((item, idx) => {
            if (idx === this.menuIndex) {
                // Draw selection indicator or highlight row
                for (let c = 1; c < 9; c++) {
                    this.grid[startRow + idx * 2][c] = 1;
                }
            }
        });
        this.renderGrid();
    }

    bindEvents() {
        document.getElementById('btn-left').addEventListener('click', () => this.handleInput('LEFT'));
        document.getElementById('btn-right').addEventListener('click', () => this.handleInput('RIGHT'));
        document.getElementById('btn-up').addEventListener('click', () => this.handleInput('UP'));
        document.getElementById('btn-down').addEventListener('click', () => this.handleInput('DOWN'));
        document.getElementById('btn-rotate').addEventListener('click', () => this.handleInput('ROTATE'));
        document.getElementById('btn-onoff').addEventListener('click', () => this.handleInput('ONOFF'));
        document.getElementById('btn-sp').addEventListener('click', () => this.handleInput('SP'));
        document.getElementById('btn-sound').addEventListener('click', () => this.handleInput('SOUND'));
        document.getElementById('btn-reset').addEventListener('click', () => this.handleInput('RESET'));

        window.addEventListener('keydown', (e) => {
            if (['ArrowLeft', 'KeyA'].includes(e.code)) { this.handleInput('LEFT'); e.preventDefault(); }
            if (['ArrowRight', 'KeyD'].includes(e.code)) { this.handleInput('RIGHT'); e.preventDefault(); }
            if (['ArrowUp', 'KeyW', 'KeyZ'].includes(e.code)) { this.handleInput('UP'); e.preventDefault(); }
            if (['ArrowDown', 'KeyS'].includes(e.code)) { this.handleInput('DOWN'); e.preventDefault(); }
            if (['Space', 'KeyX'].includes(e.code)) { this.handleInput('SP'); e.preventDefault(); }
            if (['KeyR'].includes(e.code)) { this.handleInput('RESET'); e.preventDefault(); }
            if (['KeyM'].includes(e.code)) { this.handleInput('SOUND'); e.preventDefault(); }
            if (['Enter'].includes(e.code)) { this.handleInput('ROTATE'); e.preventDefault(); }
        });
    }

    handleInput(action) {
        this.playSound('beep');
        if (action === 'SOUND') {
            this.soundEnabled = !this.soundEnabled;
            this.updateStats();
            return;
        }
        if (action === 'RESET') {
            this.stopGame();
            this.isGameOver = false;
            this.currentMode = 'MENU';
            this.menuIndex = 0;
            this.renderMenu();
            return;
        }

        if (this.currentMode === 'MENU') {
            if (action === 'UP') {
                this.menuIndex = (this.menuIndex - 1 + this.menuItems.length) % this.menuItems.length;
                this.renderMenu();
            } else if (action === 'DOWN') {
                this.menuIndex = (this.menuIndex + 1) % this.menuItems.length;
                this.renderMenu();
            } else if (action === 'SP' || action === 'ROTATE') {
                this.startGame(this.menuItems[this.menuIndex].id);
            }
        } else if (this.isGameOver) {
            // Classic handheld behaviour: after GAME OVER, S/P (or ROTATE)
            // immediately starts a fresh round of the same game; RESET is
            // still needed to go back to the game-select menu.
            if (action === 'SP' || action === 'ROTATE') {
                this.startGame(this.currentMode);
            }
        } else {
            // In-game input handling
            if (action === 'SP') {
                this.togglePause();
            } else if (!this.isPaused && this.isRunning) {
                this.processGameInput(action);
            }
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        this.updateStats();
    }

    startGame(mode) {
        this.currentMode = mode;
        this.score = 0;
        this.level = 1;
        this.speed = 1;
        this.lives = ['TANK', 'RACE', 'BREAKOUT'].includes(mode) ? 3 : 0;
        this.isRunning = true;
        this.isPaused = false;
        this.isGameOver = false;
        this.tickInterval = this.modeConfig[mode] ? this.modeConfig[mode].base : 150;
        this.updateTitle();
        this.playSound('start');

        if (mode === 'BLOCK') this.initBlockGame();
        else if (mode === 'TANK') this.initTankGame();
        else if (mode === 'RACE') this.initRaceGame();
        else if (mode === 'SNAKE') this.initSnakeGame();
        else if (mode === 'BREAKOUT') this.initBreakoutGame();

        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => this.gameLoop(), this.tickInterval);
    }

    stopGame() {
        this.isRunning = false;
        if (this.timer) clearInterval(this.timer);
    }

    loseLife() {
        this.lives--;
        this.playSound('hurt');
        this.updateTitle();
        if (this.lives <= 0) {
            this.gameOverSequence();
            return true;
        }
        return false;
    }

    gameLoop() {
        if (!this.isRunning || this.isPaused) return;

        if (this.currentMode === 'BLOCK') this.updateBlockGame();
        else if (this.currentMode === 'TANK') this.updateTankGame();
        else if (this.currentMode === 'RACE') this.updateRaceGame();
        else if (this.currentMode === 'SNAKE') this.updateSnakeGame();
        else if (this.currentMode === 'BREAKOUT') this.updateBreakoutGame();

        if (!this.isRunning) return; // a game-over triggered mid-update

        if (this.currentMode === 'BLOCK') this.renderGridWithCurrentBlock();
        else this.renderGrid();
        this.updateStats();
    }

    processGameInput(action) {
        if (this.currentMode === 'BLOCK') this.processBlockInput(action);
        else if (this.currentMode === 'TANK') this.processTankInput(action);
        else if (this.currentMode === 'RACE') this.processRaceInput(action);
        else if (this.currentMode === 'SNAKE') this.processSnakeInput(action);
        else if (this.currentMode === 'BREAKOUT') this.processBreakoutInput(action);
    }

    // ============================= BLOCK (Tetris) =============================
    // Standard rules: random tetromino, gravity drop, rotate/move, clear full
    // rows, score by lines-cleared-per-drop (single/double/triple/tetris),
    // level up every 10 lines with the drop speed increasing each level.
    initBlockGame() {
        this.clearGrid();
        const shapes = [
            [[1,1,1,1]], // I
            [[1,1],[1,1]], // O
            [[0,1,0],[1,1,1]], // T
            [[1,0,0],[1,1,1]], // L
            [[0,0,1],[1,1,1]], // J
            [[0,1,1],[1,1,0]], // S
            [[1,1,0],[0,1,1]]  // Z
        ];
        this.gameState = {
            shapes,
            curShape: this.getRandomShape(shapes),
            curX: 3,
            curY: 0,
            totalLines: 0
        };
        this.spawnBlock();
    }
    getRandomShape(shapes) {
        return shapes[Math.floor(Math.random() * shapes.length)];
    }
    spawnBlock() {
        this.gameState.curShape = this.getRandomShape(this.gameState.shapes);
        this.gameState.curX = 3;
        this.gameState.curY = 0;
        if (this.checkCollision(this.gameState.curShape, this.gameState.curX, this.gameState.curY)) {
            this.gameOverSequence();
        }
    }
    checkCollision(shape, posX, posY) {
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    let newX = posX + c;
                    let newY = posY + r;
                    if (newX < 0 || newX >= this.width || newY >= this.height) return true;
                    if (newY >= 0 && this.grid[newY][newX]) return true;
                }
            }
        }
        return false;
    }
    mergeBlock() {
        const { curShape, curX, curY } = this.gameState;
        for (let r = 0; r < curShape.length; r++) {
            for (let c = 0; c < curShape[r].length; c++) {
                if (curShape[r][c] && curY + r >= 0) {
                    this.grid[curY + r][curX + c] = 1;
                }
            }
        }
        // Check lines
        let cleared = 0;
        for (let r = this.height - 1; r >= 0; r--) {
            if (this.grid[r].every(cell => cell === 1)) {
                this.grid.splice(r, 1);
                this.grid.unshift(Array(this.width).fill(0));
                cleared++;
                r++;
            }
        }
        if (cleared > 0) {
            // Standard Nintendo-style line-clear scoring, scaled by level.
            const lineScores = [0, 100, 300, 500, 800];
            this.addScore((lineScores[cleared] || cleared * 200) * this.level);
            this.gameState.totalLines += cleared;
            this.levelUpTo(Math.floor(this.gameState.totalLines / 10) + 1);
        }
    }
    updateBlockGame() {
        this.gameState.curY++;
        if (this.checkCollision(this.gameState.curShape, this.gameState.curX, this.gameState.curY)) {
            this.gameState.curY--;
            this.mergeBlock();
            this.spawnBlock();
        }
    }
    processBlockInput(action) {
        let { curShape, curX, curY } = this.gameState;
        if (action === 'LEFT') {
            if (!this.checkCollision(curShape, curX - 1, curY)) this.gameState.curX--;
        } else if (action === 'RIGHT') {
            if (!this.checkCollision(curShape, curX + 1, curY)) this.gameState.curX++;
        } else if (action === 'DOWN') {
            // Soft drop: small reward for manually speeding the piece down.
            if (!this.checkCollision(curShape, curX, curY + 1)) {
                this.gameState.curY++;
                this.addScore(1);
            }
        } else if (action === 'UP' || action === 'ROTATE') {
            // Rotate shape (with a simple wall-kick so rotation near edges still works)
            const rotated = curShape[0].map((_, index) => curShape.map(row => row[index]).reverse());
            const kicks = [0, -1, 1, -2, 2];
            for (const k of kicks) {
                if (!this.checkCollision(rotated, curX + k, curY)) {
                    this.gameState.curShape = rotated;
                    this.gameState.curX = curX + k;
                    break;
                }
            }
        }
        this.renderGridWithCurrentBlock();
    }
    renderGridWithCurrentBlock() {
        this.renderGrid();
        if (this.currentMode === 'BLOCK' && this.gameState.curShape) {
            const { curShape, curX, curY } = this.gameState;
            for (let r = 0; r < curShape.length; r++) {
                for (let c = 0; c < curShape[r].length; c++) {
                    if (curShape[r][c] && curY + r >= 0 && curY + r < this.height && curX + c >= 0 && curX + c < this.width) {
                        this.pixels[curY + r][curX + c].classList.add('on');
                    }
                }
            }
        }
    }

    // ================================ TANK =====================================
    // Standard rules: tank can only have one live bullet in flight, bullets that
    // hit an enemy score points and the enemy respawns, enemies that reach the
    // tank's row cost a life, 3 lives before game over, kill count raises level
    // and enemy advance speed.
    initTankGame() {
        this.clearGrid();
        this.gameState = {
            tankX: 4,
            tankY: 18,
            bullets: [],
            enemies: [{ x: 2, y: 1 }, { x: 7, y: 1 }],
            kills: 0
        };
    }
    spawnTankEnemy() {
        const x = Math.floor(Math.random() * this.width);
        this.gameState.enemies.push({ x, y: 1 });
    }
    updateTankGame() {
        const { tankX, tankY, bullets, enemies } = this.gameState;

        // Move bullets up
        bullets.forEach(b => b.y--);
        this.gameState.bullets = bullets.filter(b => b.y >= 0);

        // Move enemies down (probability increases with level)
        const advanceChance = Math.min(0.65, 0.28 + this.level * 0.05);
        if (Math.random() < advanceChance) {
            enemies.forEach(e => e.y++);
        }

        // Bullet vs enemy collisions
        for (const b of this.gameState.bullets) {
            for (const e of enemies) {
                if (!e.dead && b.x === e.x && b.y === e.y) {
                    e.dead = true;
                    b.hit = true;
                    this.addScore(50);
                    this.playSound('hit');
                    this.gameState.kills++;
                    this.levelUpTo(Math.floor(this.gameState.kills / 5) + 1);
                }
            }
        }
        this.gameState.bullets = this.gameState.bullets.filter(b => !b.hit);
        const survivors = enemies.filter(e => !e.dead);
        const killedCount = enemies.length - survivors.length;
        this.gameState.enemies = survivors;
        for (let i = 0; i < killedCount; i++) this.spawnTankEnemy();

        // Enemies reaching the tank's row cost a life
        const reached = this.gameState.enemies.filter(e => e.y >= tankY - 1);
        if (reached.length > 0) {
            this.gameState.enemies = this.gameState.enemies.filter(e => e.y < tankY - 1);
            reached.forEach(() => this.spawnTankEnemy());
            if (this.loseLife()) return;
        }

        if (this.gameState.enemies.length === 0) this.spawnTankEnemy();

        // Render
        this.clearGrid();
        this.grid[tankY][tankX] = 1;
        if (tankX > 0) this.grid[tankY][tankX - 1] = 1;
        if (tankX < this.width - 1) this.grid[tankY][tankX + 1] = 1;
        if (tankY > 0) this.grid[tankY - 1][tankX] = 1;
        this.gameState.bullets.forEach(b => { if (b.y >= 0 && b.y < this.height) this.grid[b.y][b.x] = 1; });
        this.gameState.enemies.forEach(e => { if (e.y >= 0 && e.y < this.height) this.grid[e.y][e.x] = 1; });
    }
    processTankInput(action) {
        if (action === 'LEFT' && this.gameState.tankX > 1) this.gameState.tankX--;
        if (action === 'RIGHT' && this.gameState.tankX < this.width - 2) this.gameState.tankX++;
        if (action === 'UP' || action === 'ROTATE') {
            // Classic rule: only one bullet in flight at a time.
            if (this.gameState.bullets.length === 0) {
                this.gameState.bullets.push({ x: this.gameState.tankX, y: this.gameState.tankY - 2 });
            }
        }
    }

    // ================================ RACE =====================================
    // Standard rules: obstacles fall down the lane, dodging one scores points,
    // colliding with one costs a life (3 lives), speed and obstacle count both
    // increase with level.
    initRaceGame() {
        this.clearGrid();
        this.gameState = {
            carX: 4,
            obstacles: [
                { x: 2, y: -2 },
                { x: 7, y: -10 }
            ],
            dodges: 0
        };
    }
    updateRaceGame() {
        const { carX, obstacles } = this.gameState;
        let crashed = false;

        obstacles.forEach(o => {
            o.y++;
            if (o.y >= this.height) {
                o.y = -Math.floor(Math.random() * 8) - 2;
                o.x = Math.floor(Math.random() * this.width);
                this.gameState.dodges++;
                this.addScore(20);
                this.levelUpTo(Math.floor(this.gameState.dodges / 5) + 1);
            }
            // Collision: car occupies (carX,17-18) and (carX-1,18)/(carX+1,18);
            // obstacle occupies (o.x, o.y) and (o.x, o.y+1).
            const obstacleCells = [{ x: o.x, y: o.y }, { x: o.x, y: o.y + 1 }];
            const carCells = [
                { x: carX, y: 18 }, { x: carX, y: 17 },
                { x: carX - 1, y: 18 }, { x: carX + 1, y: 18 }
            ];
            for (const oc of obstacleCells) {
                for (const cc of carCells) {
                    if (oc.x === cc.x && oc.y === cc.y) crashed = true;
                }
            }
        });

        // Add a 3rd/4th obstacle as the level rises, for more traffic.
        const desiredCount = Math.min(4, 2 + Math.floor((this.level - 1) / 2));
        while (this.gameState.obstacles.length < desiredCount) {
            this.gameState.obstacles.push({ x: Math.floor(Math.random() * this.width), y: -Math.floor(Math.random() * 10) - 2 });
        }

        if (crashed) {
            // Push every obstacle away from the car so the player isn't hit again instantly.
            this.gameState.obstacles.forEach(o => { o.y = -Math.floor(Math.random() * 6) - 2; });
            if (this.loseLife()) return;
        }

        this.clearGrid();
        this.grid[18][carX] = 1;
        this.grid[17][carX] = 1;
        if (carX > 0) this.grid[18][carX - 1] = 1;
        if (carX < this.width - 1) this.grid[18][carX + 1] = 1;

        this.gameState.obstacles.forEach(o => {
            if (o.y >= 0 && o.y < this.height) this.grid[o.y][o.x] = 1;
            if (o.y + 1 >= 0 && o.y + 1 < this.height) this.grid[o.y + 1][o.x] = 1;
        });
    }
    processRaceInput(action) {
        if (action === 'LEFT' && this.gameState.carX > 1) this.gameState.carX--;
        if (action === 'RIGHT' && this.gameState.carX < this.width - 2) this.gameState.carX++;
    }

    // ================================ SNAKE =====================================
    // Standard rules: moving into a wall or into the snake's own body ends the
    // game; eating food grows the snake by one and speeds the game up slightly;
    // food never spawns on top of the snake.
    initSnakeGame() {
        this.clearGrid();
        this.gameState = {
            snake: [{ x: 5, y: 10 }, { x: 5, y: 11 }, { x: 5, y: 12 }],
            dir: { x: 0, y: -1 },
            pendingDir: null,
            food: { x: 5, y: 5 },
            eaten: 0
        };
        this.spawnSnakeFood();
    }
    spawnSnakeFood() {
        const { snake } = this.gameState;
        let food;
        let attempts = 0;
        do {
            food = {
                x: Math.floor(Math.random() * this.width),
                y: Math.floor(Math.random() * this.height)
            };
            attempts++;
        } while (snake.some(s => s.x === food.x && s.y === food.y) && attempts < 100);
        this.gameState.food = food;
    }
    updateSnakeGame() {
        if (this.gameState.pendingDir) {
            this.gameState.dir = this.gameState.pendingDir;
            this.gameState.pendingDir = null;
        }
        const { snake, dir, food } = this.gameState;
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

        // Wall collision
        if (head.x < 0 || head.x >= this.width || head.y < 0 || head.y >= this.height) {
            this.gameOverSequence();
            return;
        }

        const willEat = head.x === food.x && head.y === food.y;
        // Self collision: the tail cell is about to vacate unless we're eating,
        // so it's safe to move into it (classic Snake rule).
        const bodyToCheck = willEat ? snake : snake.slice(0, -1);
        if (bodyToCheck.some(s => s.x === head.x && s.y === head.y)) {
            this.gameOverSequence();
            return;
        }

        snake.unshift(head);
        if (willEat) {
            this.addScore(50);
            this.gameState.eaten++;
            this.levelUpTo(Math.floor(this.gameState.eaten / 5) + 1);
            this.spawnSnakeFood();
        } else {
            snake.pop();
        }

        this.clearGrid();
        this.grid[food.y][food.x] = 1;
        snake.forEach(s => this.grid[s.y][s.x] = 1);
    }
    processSnakeInput(action) {
        const { dir } = this.gameState;
        // Buffer the turn and reject 180-degree reversals (classic Snake rule:
        // you can't instantly double back into your own neck).
        if (action === 'LEFT' && dir.x === 0) this.gameState.pendingDir = { x: -1, y: 0 };
        if (action === 'RIGHT' && dir.x === 0) this.gameState.pendingDir = { x: 1, y: 0 };
        if (action === 'UP' && dir.y === 0) this.gameState.pendingDir = { x: 0, y: -1 };
        if (action === 'DOWN' && dir.y === 0) this.gameState.pendingDir = { x: 0, y: 1 };
    }

    // =============================== BREAKOUT ===================================
    // Standard rules: ball bounces off walls/ceiling/paddle, paddle hit angle
    // depends on where the ball lands, bricks nearer the ceiling are worth more,
    // missing the paddle costs a life (3 lives) and clearing every brick advances
    // to a faster new level with a fresh wall.
    initBreakoutGame() {
        this.clearGrid();
        this.gameState = {
            paddleX: 3,
            paddleWidth: 4,
            ball: { x: 4, y: 16, dx: 1, dy: -1 }
        };
        this.spawnBreakoutBricks();
    }
    spawnBreakoutBricks() {
        const bricks = [];
        for (let r = 1; r < 4; r++) {
            for (let c = 0; c < this.width; c++) {
                bricks.push({ x: c, y: r, active: true, value: (4 - r) * 10 });
            }
        }
        this.gameState.bricks = bricks;
    }
    resetBreakoutBall() {
        this.gameState.ball = { x: this.gameState.paddleX + 1, y: 16, dx: Math.random() < 0.5 ? -1 : 1, dy: -1 };
    }
    updateBreakoutGame() {
        const { ball, paddleX, paddleWidth, bricks } = this.gameState;
        ball.x += ball.dx;
        ball.y += ball.dy;

        if (ball.x <= 0 || ball.x >= this.width - 1) ball.dx *= -1;
        if (ball.y <= 0) ball.dy *= -1;

        // Paddle collision: only bounces while travelling downward, and the exit
        // angle depends on where along the paddle the ball lands.
        if (ball.dy > 0 && ball.y >= 18 && ball.x >= paddleX && ball.x < paddleX + paddleWidth) {
            ball.y = 18;
            ball.dy = -1;
            const hitPos = ball.x - (paddleX + (paddleWidth - 1) / 2);
            ball.dx = hitPos < 0 ? -1 : (hitPos > 0 ? 1 : ball.dx);
            this.playSound('hit');
        }

        // Brick collision
        for (const b of bricks) {
            if (b.active && b.x === ball.x && b.y === ball.y) {
                b.active = false;
                ball.dy *= -1;
                this.addScore(b.value);
                this.playSound('hit');
                break;
            }
        }

        // Missed the paddle
        if (ball.y >= this.height) {
            if (this.loseLife()) return;
            this.resetBreakoutBall();
        }

        // Cleared the wall: next level, faster ball, fresh bricks
        if (bricks.every(b => !b.active)) {
            this.levelUpTo(this.level + 1);
            this.spawnBreakoutBricks();
            this.resetBreakoutBall();
        }

        this.clearGrid();
        for (let i = 0; i < paddleWidth; i++) {
            if (paddleX + i < this.width) this.grid[18][paddleX + i] = 1;
        }
        if (ball.x >= 0 && ball.x < this.width && ball.y >= 0 && ball.y < this.height) {
            this.grid[ball.y][ball.x] = 1;
        }
        bricks.forEach(b => {
            if (b.active) this.grid[b.y][b.x] = 1;
        });
    }
    processBreakoutInput(action) {
        if (action === 'LEFT' && this.gameState.paddleX > 0) {
            this.gameState.paddleX--;
        } else if (action === 'RIGHT' && this.gameState.paddleX + this.gameState.paddleWidth < this.width) {
            this.gameState.paddleX++;
        }
    }

    gameOverSequence() {
        this.stopGame();
        this.isGameOver = true;
        this.playSound('gameover');
        document.getElementById('lcd-title').textContent = 'GAME OVER';
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.gameConsole = new BrickGameConsole();
});
