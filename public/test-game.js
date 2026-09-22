class TestGame {
    constructor() {
        this.engine = null;
        this.pos = { x: 4, y: 0 };
        this.size = 2;
        this.color = 1;
        this.dropCounter = 0;
        this.dropInterval = 1000;
    }

    init() {
        this.reset();
    }

    reset() {
        this.pos = { x: 4, y: 0 };
        this.dropCounter = 0;
    }

    update(dt) {
        this.dropCounter += dt;
        if (this.dropCounter > this.dropInterval) {
            this.moveDown();
            this.dropCounter = 0;
        }
    }

    moveDown() {
        this.pos.y++;
        if (this.pos.y > 18) {
            this.pos.y = 0;
            this.engine.addScore(10);
        }
    }

    handleInput(action) {
        switch(action) {
            case 'LEFT':
                if (this.pos.x > 0) this.pos.x--;
                break;
            case 'RIGHT':
                if (this.pos.x < 10 - this.size) this.pos.x++;
                break;
            case 'DOWN':
                this.moveDown();
                break;
            case 'ROTATE':
                this.size = this.size === 2 ? 1 : 2;
                break;
        }
    }

    render(mainGrid, nextGrid) {
        // Render 2x2 block
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const gridX = this.pos.x + x;
                const gridY = this.pos.y + y;
                if (gridX >= 0 && gridX < 10 && gridY >= 0 && gridY < 20) {
                    mainGrid[gridY * 10 + gridX].classList.add('on');
                }
            }
        }

        // Render next preview (static for test)
        nextGrid[5].classList.add('on');
        nextGrid[6].classList.add('on');
        nextGrid[9].classList.add('on');
        nextGrid[10].classList.add('on');
    }

    pause() {}
    resume() {}
}