const { Canvas, Image } = require("canvas");
const lzma = require("lzma");

let games = {
    "tictactoe": require("./tictactoe.js"),
//  "connectfour": require("./connectfour"),
//  "chess": require("./chess"),
};

module.exports = {
    getGame,
    encodeImage,
    decodeImage,
};

let canvas = new Canvas(640, 360);
let ctx = canvas.getContext("2d");

function getGame(type) {
    return games[type];
}

function encodeImage(rgba, data, callback) {
    let json = JSON.stringify(data);

    lzma.compress(Buffer.from(json), 9, (bytes) => {
        let imageData = ctx.createImageData(canvas.width, canvas.height);

        for (let i = 0; i < rgba.data.length; i += 4) {
            let alpha = rgba.data[i + 3];
            imageData.data[i + 0] = alpha > 0 ? rgba.data[i + 0] : 255;
            imageData.data[i + 1] = alpha > 0 ? rgba.data[i + 1] : 255;
            imageData.data[i + 2] = alpha > 0 ? rgba.data[i + 2] : 255;
            imageData.data[i + 3] = 255;
        }

        let k = 0;
        let writeByte = (byteValue) => {
            for (let i = 0; i < 4; i++) {
                let twoBits = (byteValue >> (2 * (3 - i))) & 3;
                imageData.data[k] = (imageData.data[k] & 252) + twoBits;
                k += 1;
                if ((k + 1) % 4 === 0) {
                    k += 1;
                }
            }
        };

        for (let i = 0; i < 4; i++) {
            let byteValue = (bytes.length >> (8 * (3 - i))) & 255;
            writeByte(byteValue);
        }
        for (let i = 0; i < bytes.length; i++) {
            writeByte(bytes[i]);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(imageData, 0, 0);
        let stream = canvas.createPNGStream();

        let chunks = [];
        stream.on("data", (chunk) => {
            chunks.push(chunk);
        });
        stream.on("end", () => {
            let png = Buffer.concat(chunks);
            callback(png);
        });
    });
}

function decodeImage(png, callback) {
    let image = new Image();
    image.onerror = () => {
        callback(null);
    };
    image.onload = () => {
        image.onload = null;
        image.onerror = null;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);

        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        let k = 0;
        let readByte = () => {
            let byteValue = 0;
            for (let i = 0; i < 4; i++) {
                let twoBits = imageData.data[k] & 3;
                byteValue = (byteValue << 2) + twoBits;
                k += 1;
                if ((k + 1) % 4 === 0) {
                    k += 1;
                }
            }
            return byteValue;
        };

        let length = 0;
        for (let i = 0; i < 4; i++) {
            let byteValue = readByte();
            length = (length << 8) + byteValue;
        }
        let bytes = Buffer.alloc(length);
        for (let i = 0; i < length; i++) {
            bytes[i] = readByte();
        }

        lzma.decompress(bytes, (json) => {
            try {
                let data = JSON.parse(json);
                callback(data);
            } catch (err) {
                callback(null);
            }
        });
    };
    image.src = png;
}
