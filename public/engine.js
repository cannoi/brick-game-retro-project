class GameEngine {
    constructor(gridId, nextGridId) {
        this.gridElement = document.getElementById(gridId);
        this.nextGridElement = document.getElementById(nextGridId);
        this.cells = [];
        this.nextCells = [];
        this.game = null;
        this.isRunning = false;
        this.isPaused = false;
        this.lastTime = 0;
        this.accumulator = 0;
        this.tickRate = 1000 / 60; // 60 FPS

        this.state = {
            score: 0,
            highScore: parseInt(localStorage.getItem('brick_game_hi_score')) || 0,
            level: 1,
            speed: 1,
            gameOver: false
        };

        this.initGrid();
        this.updateUI();
    }

    initGrid() {
        this.gridElement.innerHTML = '';
        for (let i = 0; i < 200; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            this.gridElement.appendChild(cell);
            this.cells.push(cell);
        }

        this.nextGridElement.innerHTML = '';
        for (let i = 0; i < 16; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            this.nextGridElement.appendChild(cell);
            this.nextCells.push(cell);
        }
    }

    setGame(gameModule) {
        this.game = gameModule;
        this.game.engine = this;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.state.gameOver = false;
        if (this.game) this.game.init();
        requestAnimationFrame(this.loop.bind(this));
    }

    pause() {
        this.isPaused = !this.isPaused;
        document.getElementById('icon-pause').style.opacity = this.isPaused ? '1' : '0.2';
        if (this.game) {
            if (this.isPaused) this.game.pause();
            else this.game.resume();
        }
    }

    reset() {
        this.state.score = 0;
        this.state.level = 1;
        this.state.speed = 1;
        this.state.gameOver = false;
        this.updateUI();
        if (this.game) this.game.reset();
    }

    loop(time) {
        if (!this.isRunning) return;

        const dt = time - this.lastTime;
        this.lastTime = time;

        if (!this.isPaused && !this.state.gameOver) {
            this.accumulator += dt;
            while (this.accumulator >= this.tickRate) {
                if (this.game) this.game.update(this.tickRate);
                this.accumulator -= this.tickRate;
            }
        }

        this.render();
        requestAnimationFrame(this.loop.bind(this));
    }

    render() {
        // Clear grids
        this.cells.forEach(c => c.classList.remove('on'));
        this.nextCells.forEach(c => c.classList.remove('on'));

        if (this.game) {
            this.game.render(this.cells, this.nextCells);
        }
    }

    addScore(points) {
        this.state.score += points;
        if (this.state.score > this.state.highScore) {
            this.state.highScore = this.state.score;
            localStorage.setItem('brick_game_hi_score', this.state.highScore);
        }
        this.updateUI();
    }

    updateUI() {
        document.getElementById('score-val').textContent = String(this.state.score).padStart(6, '0');
        document.getElementById('hi-score-val').textContent = String(this.state.highScore).padStart(6, '0');
        document.getElementById('level-val').textContent = String(this.state.level).padStart(2, '0');
        document.getElementById('speed-val').textContent = String(this.state.speed).padStart(2, '0');
    }

    handleInput(action) {
        if (this.state.gameOver && action === 'RESET') {
            this.reset();
            return;
        }
        if (this.game && !this.isPaused) {
            this.game.handleInput(action);
        }
    }
}