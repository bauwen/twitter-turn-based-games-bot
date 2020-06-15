const { Canvas } = require("canvas");

module.exports = {
    getType,
    isValidInput,
    getTweetText,
    getInitialState,
    getNextState,
    getImageData,
    getCurrentPlayer,
    getWinner,
};

let canvas = new Canvas(640, 360);
let ctx = canvas.getContext("2d");

function getType() {
    return "tictactoe";
}

function isValidInput(command) {
    let number = parseInt(command);
    return !isNaN(number) && 1 <= number && number <= 9;
}

function getTweetText(state, playerNames) {
    let text = "";

    if (state.empty) {
        text += "You started a game of Tic-Tac-Toe!\n\n";
        text += `❌ @${playerNames[0]}` + " (your turn!)\n";
        text += `⭕ @${playerNames[1]}` + "\n";
    } else {
        if (state.winner) {
            let index = getWinner(state);
            text += "GAME OVER!\n\n";
            text += `❌ @${playerNames[0]}` + (index === 0 ? " wins the game!" : "") + "\n"
            text += `⭕ @${playerNames[1]}` + (index === 1 ? " wins the game!" : "") + "\n";
        } else {
            let index = getCurrentPlayer(state);
            text += "\u200D\n";
            text += `❌ @${playerNames[0]}` + (index === 0 ? " (your turn!)" : "") + "\n";
            text += `⭕ @${playerNames[1]}` + (index === 1 ? " (your turn!)" : "") + "\n";
        }
    }

    return text;
}

function getInitialState(args) {
    return {
        grid: new Array(9).fill(''),
        starter: 'x',
        current: 'x',
        empty: true,
        full: false,
        winner: '',
        tiles: [0, 0, 0],
    };
}

function getNextState(state, command) {
    let position = parseInt(command) - 1;
    if (state.winner || state.grid[position] !== '') {
        return null;
    }
    let grid = [...state.grid];
    grid[position] = state.current;
    return {
        grid,
        starter: state.starter,
        current: state.current === 'x' ? 'o' : 'x',
        empty: false,
        full: grid.filter(v => v === '').length === 0,
        ...checkWinner(grid),
    };
}

function getImageData(state) {
    let cx = Math.floor(canvas.width / 2);
    let cy = Math.floor(canvas.height / 2);
    let size = Math.floor((canvas.height - 2 * 30) / 3);
    let ox = Math.floor(cx - size - size / 2);
    let oy = Math.floor(cy - size - size / 2);

    ctx.fillStyle = "rgb(160, 210, 200)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "black";
    ctx.lineWidth = 12;
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < state.grid.length; i++) {
        let cell = state.grid[i];
        let x = Math.floor(ox + (i % 3) * size + size / 2);
        let y = Math.floor(oy + Math.floor(i / 3) * size + size / 2);
        let r = 20;
        let p = 3;
        if (false && state.winner && state.tiles.indexOf(i) >= 0) {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = "white";
            ctx.fillRect(x - size / 2, y - size / 2, size, size);
            ctx.globalAlpha = 1;
        }
        if (cell) {
            if (cell === 'x') {
                ctx.globalAlpha = 0.2;
                ctx.strokeStyle = "black";

                ctx.beginPath();
                ctx.moveTo(p + x - r, p + y - r);
                ctx.lineTo(p + x + r, p + y + r);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(p + x - r, p + y + r);
                ctx.lineTo(p + x + r, p + y - r);
                ctx.stroke();

                ctx.globalAlpha = 1;
                ctx.strokeStyle = "black";

                ctx.beginPath();
                ctx.moveTo(x - r, y - r);
                ctx.lineTo(x + r, y + r);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x - r, y + r);
                ctx.lineTo(x + r, y - r);
                ctx.stroke();
            } else {
                ctx.globalAlpha = 0.2;
                ctx.strokeStyle = "black";

                ctx.beginPath();
                ctx.arc(p + x, p + y, r, 0, 2 * Math.PI);
                ctx.stroke();

                ctx.globalAlpha = 1;
                ctx.strokeStyle = "black";

                ctx.beginPath();
                ctx.arc(x, y, r, 0, 2 * Math.PI);
                ctx.stroke();
            }
        } else if (!state.winner) {
            ctx.globalAlpha = 0.08;
            ctx.fillStyle = "black";
            ctx.fillText(i + 1, x, y);
            ctx.globalAlpha = 1;
        }
    }

    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;

    for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(ox + i * size, oy);
        ctx.lineTo(ox + i * size, oy + size * 3);
        ctx.stroke();
    }
    for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(ox, oy + i * size);
        ctx.lineTo(ox + size * 3, oy + i * size);
        ctx.stroke();
    }

    if (state.winner) {
        ctx.strokeStyle = "rgb(160, 0, 0)";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.lineCap = "round";

        for (let j = 0; j < state.tiles.length; j++) {
            let i = state.tiles[j];
            let cell = state.grid[i];
            let x = Math.floor(ox + (i % 3) * size + size / 2);
            let y = Math.floor(oy + Math.floor(i / 3) * size + size / 2);
            let r = 20;
            let p = 3;

            if (j !== 1) {
                let k = state.tiles[1];
                switch (k) {
                    case 1:
                    case 7:
                        x = Math.floor(x + (i % 3 - k % 3) * size / 2);
                        break;
                    case 3:
                    case 5:
                        y = Math.floor(y + (Math.floor(i / 3) - Math.floor(k / 3)) * size / 2);
                        break;
                    case 4:
                        x = Math.floor(x + (i % 3 - k % 3) * size / 2);
                        y = Math.floor(y + (Math.floor(i / 3) - Math.floor(k / 3)) * size / 2);
                        break;
                }
                if (j === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
    }

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function getCurrentPlayer(state) {
    return state.current === state.starter ? 0 : 1;
}

function getWinner(state) {
    if (state.winner) {
        return state.winner === state.starter ? 0 : 1;
    }
    return -1;
}

function checkWinner(grid) {
    for (let i = 0; i < 2; i++) {
        const p = ['x', 'o'][i];
        // -
        for (let j = 0; j < 9; j += 3) {
            if (grid[j + 0] === p && grid[j + 1] === p && grid[j + 2] === p) {
                return {
                    winner: p,
                    tiles: [j + 0, j + 1, j + 2],
                }
            }
        }
        // |
        for (let j = 0; j < 3; j += 1) {
            if (grid[j + 0] === p && grid[j + 3] === p && grid[j + 6] === p) {
                return {
                    winner: p,
                    tiles: [j + 0, j + 3, j + 6],
                }
            }
        }
        // \ 
        if (grid[0] === p && grid[4] === p && grid[8] === p) {
            return {
                winner: p,
                tiles: [0, 4, 8],
            }
        }
        // /
        if (grid[2] === p && grid[4] === p && grid[6] === p) {
            return {
                winner: p,
                tiles: [2, 4, 6],
            }
        }
    }
    return {
        winner: '',
        tiles: [0, 0, 0],
    }
}
