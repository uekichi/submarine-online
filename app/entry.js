'use strict';
import $ from 'jquery';
import io from 'socket.io-client';

const gameObj = {
    raderCanvasWidth: 500,
    raderCanvasHeight: 500,
    scoreCanvasWidth: 300,
    scoreCanvasHeight: 500,
    itemRadius: 4,
    airRadius: 6,
    bomCellPx: 32,
    deg: 0,
    counter: 0,
    rotationDegreeByDirection: {
        'left': 0,
        'up': 270,
        'down': 90,
        'right': 0
    },
    rotationDegreeByFlyingMissileDirection: {
        'left': 270,
        'up': 0,
        'down': 180,
        'right': 90
    },
    myDisplayName: $('#main').attr('data-displayName'),
    myThumbUrl: $('#main').attr('data-thumbUrl'),
    fieldWidth: null,
    fieldHeight: null,
    itemsMap: new Map(),
    airMap: new Map(),
    flyingMissilesMap: new Map(),
    championScore: 0,
    championName: null
};

const socketQueryParameters = `displayName=${gameObj.myDisplayName}&thumbUrl=${gameObj.myThumbUrl}`;
const socket = io($('#main').attr('data-process.env.ipAddress') + '?' + socketQueryParameters);

function init() {

  //ゲーム用キャンバス
    const raderCanvas = $('#rader')[0];
    raderCanvas.width = gameObj.raderCanvasWidth;
    raderCanvas.height = gameObj.raderCanvasHeight;
    gameObj.ctxRader = raderCanvas.getContext('2d');

  // ランキング用のキャンバス
    const scoreCanvas = $('#score')[0];
    scoreCanvas.width = gameObj.scoreCanvasWidth;
    scoreCanvas.height = gameObj.scoreCanvasHeight;
    gameObj.ctxScore = scoreCanvas.getContext('2d');

  // 潜水艦の画像
    const submarineImage = new Image();
    submarineImage.src = '/images/submarine.png';
    gameObj.submarineImage = submarineImage;

  //ミサイルの画像
    gameObj.missileImage = new Image();
    gameObj.missileImage.src = '/images/missile.png';

    //爆発の画像集
    gameObj.bomListImage = new Image();
    gameObj.bomListImage.src = '/images/bomlist.png';
}
init();

function ticker() {
    if (!gameObj.myPlayerObj || !gameObj.playersMap) return;

    gameObj.ctxRader.clearRect(0, 0, gameObj.raderCanvasWidth, gameObj.raderCanvasHeight); // 範囲を消している
    drawRadar(gameObj.ctxRader);
    drawMap(gameObj);
    drawSubmarine(gameObj.ctxRader, gameObj.myPlayerObj);
    if (gameObj.myPlayerObj.isAlive === false && gameObj.myPlayerObj.deadCount > 60) {
        drawGameOver(gameObj.ctxRader);
    }

    gameObj.ctxScore.clearRect(0, 0, gameObj.scoreCanvasWidth, gameObj.scoreCanvasHeight);  
    drawAirTimer(gameObj.ctxScore, gameObj.myPlayerObj.airTime);
    drawMissiles(gameObj.ctxScore, gameObj.myPlayerObj.missilesMany);
    drawScore(gameObj.ctxScore, gameObj.myPlayerObj.score);
    drawRanking(gameObj.ctxScore, gameObj.playersMap);
    //ラグ対処
    moveInClient(gameObj.myPlayerObj, gameObj.flyingMissilesMap);

    gameObj.counter = (gameObj.counter + 1) % 10000;
}
setInterval(ticker, 33);

function drawGameOver(ctxRader) {
    ctxRader.font = 'bold 76px arial black';
    ctxRader.fillStyle = "yellow";
    ctxRader.fillText('Game Over', 20, 270);
}

//キーボード操作
$(window).keydown(function(event) {
    if (!gameObj.myPlayerObj || gameObj.myPlayerObj.isAlive === false) return;

    switch (event.key) {
        case 'ArrowLeft':
            if (gameObj.myPlayerObj.direction === 'left') break; //向きが一緒ならブレイク
            gameObj.myPlayerObj.direction = 'left';
            drawSubmarine(gameObj.ctxRader, gameObj.myPlayerObj);
            sendChangeDirection(socket, 'left');
            break;
        case 'ArrowUp':
            if (gameObj.myPlayerObj.direction === 'up') break;
            gameObj.myPlayerObj.direction = 'up';
            drawSubmarine(gameObj.ctxRader, gameObj.myPlayerObj);
            sendChangeDirection(socket, 'up');
            break;
        case 'ArrowDown':
            if (gameObj.myPlayerObj.direction === 'down') break;
            gameObj.myPlayerObj.direction = 'down';
            drawSubmarine(gameObj.ctxRader, gameObj.myPlayerObj);
            sendChangeDirection(socket, 'down');
            break;
        case 'ArrowRight':
            if (gameObj.myPlayerObj.direction === 'right') break;
            gameObj.myPlayerObj.direction = 'right';
            drawSubmarine(gameObj.ctxRader, gameObj.myPlayerObj);
            sendChangeDirection(socket, 'right');
            break;
        case ' ': // スペースキー
            if (gameObj.myPlayerObj.missilesMany <= 0) break; // ミサイルのストックが 0

            gameObj.myPlayerObj.missilesMany -= 1;
            const missileId = Math.floor(Math.random() * 100000) + ',' + gameObj.myPlayerObj.socketId + ',' + gameObj.myPlayerObj.x + ',' + gameObj.myPlayerObj.y;

            const missileObj = {
                emitPlayerId: gameObj.myPlayerObj.playerId,
                x: gameObj.myPlayerObj.x,
                y: gameObj.myPlayerObj.y,
                direction: gameObj.myPlayerObj.direction,
                id: missileId
            };
            gameObj.flyingMissilesMap.set(missileId, missileObj);
            sendMissileEmit(socket, gameObj.myPlayerObj.direction);
            break;
    }
});

function sendChangeDirection(socket, direction) {
    socket.emit('change direction', direction);
}

function sendMissileEmit(socket, direction) {
        socket.emit('missile emit', direction);
}


function moveInClient(myPlayerObj, flyingMissilesMap) {

    if (myPlayerObj.isAlive === false) {
        if (myPlayerObj.deadCount < 60) {
            myPlayerObj.deadCount += 1;
        }
        return;
    }

    // 移動
    switch (myPlayerObj.direction) {
        case 'left':
            myPlayerObj.x -= 2;
            break;
        case 'up':
            myPlayerObj.y -= 2;
            break;
        case 'down':
            myPlayerObj.y += 2;
            break;
        case 'right':
            myPlayerObj.x += 2;
            break;
    }
    if (myPlayerObj.x > gameObj.fieldWidth) myPlayerObj.x -= gameObj.fieldWidth;
    if (myPlayerObj.x < 0) myPlayerObj.x += gameObj.fieldWidth;
    if (myPlayerObj.y < 0) myPlayerObj.y += gameObj.fieldHeight;
    if (myPlayerObj.y > gameObj.fieldHeight) myPlayerObj.y -= gameObj.fieldHeight;

    myPlayerObj.aliveTime.clock += 1;
    if (myPlayerObj.aliveTime.clock === 30) {
        myPlayerObj.aliveTime.clock = 0;
        myPlayerObj.aliveTime.seconds += 1;
    }

    // 飛んでいるミサイルの移動
    for (let [missileId, flyingMissile] of flyingMissilesMap) {

        switch (flyingMissile.direction) {
            case 'left':
                flyingMissile.x -= gameObj.missileSpeed;
                break;
            case 'up':
                flyingMissile.y -= gameObj.missileSpeed;
                break;
            case 'down':
                flyingMissile.y += gameObj.missileSpeed;
                break;
            case 'right':
                flyingMissile.x += gameObj.missileSpeed;
                break;
        }
        if (flyingMissile.x > gameObj.fieldWidth) flyingMissile.x -= gameObj.fieldWidth;
        if (flyingMissile.x < 0) flyingMissile.x += gameObj.fieldWidth;
        if (flyingMissile.y < 0) flyingMissile.y += gameObj.fieldHeight;
        if (flyingMissile.y > gameObj.fieldHeight) flyingMissile.y -= gameObj.fieldHeight;
    }
}

// レーダーの描画
function drawRadar(ctxRader) {
    const x = gameObj.raderCanvasWidth / 2;
    const y = gameObj.raderCanvasHeight / 2;
    const r = gameObj.raderCanvasWidth * 1.5 / 2;

    ctxRader.save();

    ctxRader.beginPath();
    ctxRader.translate(x, y);
    ctxRader.rotate(getRadian(gameObj.deg));

    ctxRader.fillStyle = 'rgba(0, 220, 0, 0.5)';
    ctxRader.arc(0, 0, r, getRadian(0), getRadian(-30), true);
    ctxRader.lineTo(0, 0);

    ctxRader.fill();
    ctxRader.restore();
    gameObj.deg = (gameObj.deg + 5) % 360;
}

//潜水艦の描画
function drawSubmarine(ctxRader, myPlayerObj) {

    if (myPlayerObj.isAlive === false) {
        drawBom(ctxRader, gameObj.raderCanvasWidth / 2, gameObj.raderCanvasHeight / 2, myPlayerObj.deadCount);
        return;
    }

    const rotationDegree = gameObj.rotationDegreeByDirection[myPlayerObj.direction];
    ctxRader.save();
    ctxRader.translate(gameObj.raderCanvasWidth / 2, gameObj.raderCanvasHeight / 2);

    ctxRader.rotate(getRadian(rotationDegree));
    if (myPlayerObj.direction === 'left') {
        ctxRader.scale(-1, 1);
    }
    ctxRader.drawImage(gameObj.submarineImage, -(gameObj.submarineImage.width / 2), -(gameObj.submarineImage.height / 2));
    ctxRader.restore();
}

//爆発のアニメーション
function drawBom(ctxRader, drawX, drawY, deadCount) {
    if (deadCount >= 60) return;

    const drawBomNumber = Math.floor(deadCount / 6);
    const cropX = (drawBomNumber % (gameObj.bomListImage.width / gameObj.bomCellPx)) * gameObj.bomCellPx;
    const cropY = Math.floor(drawBomNumber / (gameObj.bomListImage.width / gameObj.bomCellPx)) * gameObj.bomCellPx;

    ctxRader.drawImage(
        gameObj.bomListImage,
        cropX, cropY,
        gameObj.bomCellPx, gameObj.bomCellPx,
        drawX - gameObj.bomCellPx / 2, drawY - gameObj.bomCellPx / 2,
        gameObj.bomCellPx, gameObj.bomCellPx
    ); // 画像データ、切り抜き左、切り抜き上、幅、幅、表示x、表示y、幅、幅
}

//ミサイル格納の描画
function drawMissiles(ctxScore, missilesMany) {
    for (let i = 0; i < missilesMany; i++) {
        ctxScore.drawImage(gameObj.missileImage, 50 * i, 80);
    }
}

//空気残存量の描画
function drawAirTimer(ctxScore, airTime) {
    ctxScore.fillStyle = "rgb(0, 220, 250)";
    ctxScore.font = 'bold 40px Arial';
    ctxScore.fillText(airTime, 110, 50);
}

//スコアの描画
function drawScore(ctxScore, score) {
    ctxScore.fillStyle = "rgb(26, 26, 26)";
    ctxScore.font = '28px Arial';
    ctxScore.fillText(`score: ${score}`, 10, 180);
}

//ランキングの描画
function drawRanking(ctxScore, playersMap) {
    const playersArray = [].concat(Array.from(playersMap)); //連想配列でソートが出来ないためArrayにする
    playersArray.sort(function(a,b) {
        return b[1].score - a[1].score;
    });

    ctxScore.fillStyle = "rgb(0, 0, 0)";
    ctxScore.fillRect(0, 220, gameObj.scoreCanvasWidth, 3); //塗りつぶし四角

    ctxScore.fillStyle = "rgb(26, 26, 26)";
    ctxScore.font = '20px Arial';
    
    //最高記録者を表示　クライアント側ではだめ
    /*
    if (gameObj.championScore < playersArray[0][1].score) {
        gameObj.championScore = playersArray[0][1].score;
        gameObj.championName = playersArray[0][1].displayName
    }
    
    ctxScore.fillText(
        `最高記録 ${gameObj.championName} ${gameObj.championScore}`,
        10, 210
    );
    */

    for (let i = 0; i < 10; i++) {
        if (!playersArray[i]) return;

        const rank = i + 1;
        ctxScore.fillText(
            `${rank}位 ${playersArray[i][1].displayName} ${playersArray[i][1].score}`,
            10, 220 + (rank * 26)
        );
    }
}

socket.on('start data', (startObj) => {
    gameObj.fieldWidth = startObj.fieldWidth;
    gameObj.fieldHeight = startObj.fieldHeight;
    gameObj.myPlayerObj = startObj.playerObj; // 自分のデータをゲームオブジェクトに設定している
    gameObj.missileSpeed = startObj.missileSpeed;
});

socket.on('map data', (compressed) => {
    //配列で送られてきたのを戻してゲームオブジェクトに設定
    const playersArray = compressed[0];
    const itemsArray = compressed[1];
    const airArray = compressed[2];
    const flyingMissilesArray = compressed[3];

    gameObj.playersMap = new Map();
    for (let compressedPlayerData of playersArray) {

        const player = {};
        player.x = compressedPlayerData[0];
        player.y = compressedPlayerData[1];
        player.playerId = compressedPlayerData[2];
        player.displayName = compressedPlayerData[3];
        player.score = compressedPlayerData[4];
        player.isAlive = compressedPlayerData[5];
        player.direction = compressedPlayerData[6];
        player.missilesMany = compressedPlayerData[7];
        player.airTime = compressedPlayerData[8];
        player.deadCount = compressedPlayerData[9];

        gameObj.playersMap.set(player.playerId, player);

      //自分の情報も更新  必要な項目だけ
        if (player.playerId === gameObj.myPlayerObj.playerId) {
            gameObj.myPlayerObj.x = compressedPlayerData[0];
            gameObj.myPlayerObj.y = compressedPlayerData[1];
            gameObj.myPlayerObj.displayName = compressedPlayerData[3];
            gameObj.myPlayerObj.score = compressedPlayerData[4];
            gameObj.myPlayerObj.isAlive = compressedPlayerData[5];
            gameObj.myPlayerObj.missilesMany = compressedPlayerData[7];
            gameObj.myPlayerObj.airTime = compressedPlayerData[8];
            gameObj.myPlayerObj.deadCount = compressedPlayerData[9];
        }
    }  

    gameObj.itemsMap = new Map();
    itemsArray.forEach((compressedItemData, index) => {
        gameObj.itemsMap.set(index, { x: compressedItemData[0], y: compressedItemData[1] });       
    });

    gameObj.airMap = new Map();
    airArray.forEach((compressedAirData, index) => {
        gameObj.airMap.set(index, { x: compressedAirData[0], y: compressedAirData[1] });     
    });

    gameObj.flyingMissilesMap = new Map();
    flyingMissilesArray.forEach((compressedFlyingMissileData, index) => {
        gameObj.flyingMissilesMap.set(index, {
            x: compressedFlyingMissileData[0],
            y: compressedFlyingMissileData[1],
            direction: compressedFlyingMissileData[2],
            emitPlayerId: compressedFlyingMissileData[3]
        });
    });
});

function getRadian(deg) {
  return deg * Math.PI / 180
}

//ゲーム画面の全てを描画（自分以外）
function drawMap(gameObj) {

    // 敵プレイヤーと NPC の描画
    for (let [key, tekiPlayerObj] of gameObj.playersMap) {
        if (key === gameObj.myPlayerObj.playerId) { continue; } // 自分は描画しない

        const distanceObj = calculationBetweenTwoPoints(
            gameObj.myPlayerObj.x, gameObj.myPlayerObj.y,
            tekiPlayerObj.x, tekiPlayerObj.y,
            gameObj.fieldWidth, gameObj.fieldHeight,
            gameObj.raderCanvasWidth, gameObj.raderCanvasHeight
        );

        if (distanceObj.distanceX <= (gameObj.raderCanvasWidth / 2) && distanceObj.distanceY <= (gameObj.raderCanvasHeight / 2)) {

            if (tekiPlayerObj.isAlive === false) {
                drawBom(gameObj.ctxRader, distanceObj.drawX, distanceObj.drawY, tekiPlayerObj.deadCount);
                continue;
            }

            const degreeDiff = calcDegreeDiffFromRader(gameObj.deg, distanceObj.degree);
            const toumeido = calcOpacity(degreeDiff);

            const drawRadius = gameObj.counter % 12 + 2 + 12;
            const clearRadius = drawRadius - 2;
            const drawRadius2 = gameObj.counter % 12 + 2;
            const clearRadius2 = drawRadius2 - 2;

            gameObj.ctxRader.fillStyle = `rgba(0, 0, 255, ${toumeido})`;
            gameObj.ctxRader.beginPath();
            gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, drawRadius, 0, Math.PI * 2, true);
            gameObj.ctxRader.fill();

            gameObj.ctxRader.fillStyle = `rgb(0, 20, 50)`;
            gameObj.ctxRader.beginPath();
            gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, clearRadius, 0, Math.PI * 2, true);
            gameObj.ctxRader.fill();

            gameObj.ctxRader.fillStyle = `rgba(0, 0, 255, ${toumeido})`;
            gameObj.ctxRader.beginPath();
            gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, drawRadius2, 0, Math.PI * 2, true);
            gameObj.ctxRader.fill();

            gameObj.ctxRader.fillStyle = `rgb(0, 20, 50)`;
            gameObj.ctxRader.beginPath();
            gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, clearRadius2, 0, Math.PI * 2, true);
            gameObj.ctxRader.fill();

            if (tekiPlayerObj.displayName === 'anonymous') {

                gameObj.ctxRader.strokeStyle = `rgba(250, 250, 250, ${toumeido})`;
                gameObj.ctxRader.fillStyle = `rgba(250, 250, 250, ${toumeido})`;
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.moveTo(distanceObj.drawX, distanceObj.drawY);
                gameObj.ctxRader.lineTo(distanceObj.drawX + 20, distanceObj.drawY - 20);
                gameObj.ctxRader.lineTo(distanceObj.drawX + 20 + 40, distanceObj.drawY - 20);
                gameObj.ctxRader.stroke();

                gameObj.ctxRader.font = '8px Arial';
                gameObj.ctxRader.fillText('anonymous', distanceObj.drawX + 20, distanceObj.drawY - 20 - 1);

            } else if (tekiPlayerObj.displayName) {

                gameObj.ctxRader.strokeStyle = `rgba(250, 250, 250, ${toumeido})`;
                gameObj.ctxRader.fillStyle = `rgba(250, 250, 250, ${toumeido})`;
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.moveTo(distanceObj.drawX, distanceObj.drawY);
                gameObj.ctxRader.lineTo(distanceObj.drawX + 20, distanceObj.drawY - 20);
                gameObj.ctxRader.lineTo(distanceObj.drawX + 20 + 40, distanceObj.drawY - 20);
                gameObj.ctxRader.stroke();

                gameObj.ctxRader.font = '8px Arial';
                gameObj.ctxRader.fillText(tekiPlayerObj.displayName, distanceObj.drawX + 20, distanceObj.drawY - 20 - 1);

            }
        }
    }


    //アイテムの描画
    for (let [index, item] of gameObj.itemsMap) {

        const distanceObj = calculationBetweenTwoPoints(
            gameObj.myPlayerObj.x,
            gameObj.myPlayerObj.y,
            item.x,
            item.y,
            gameObj.fieldWidth,
            gameObj.fieldHeight,
            gameObj.raderCanvasWidth,
            gameObj.raderCanvasHeight
        );
        // レーダーの長さ以内の時
        if (distanceObj.distanceX <= (gameObj.raderCanvasWidth / 2) && distanceObj.distanceY <= (gameObj.raderCanvasHeight / 2)) {
            
            const degreeDiff = calcDegreeDiffFromRader(gameObj.deg, distanceObj.degree);
            const toumeido = calcOpacity(degreeDiff);

            gameObj.ctxRader.fillStyle = `rgb(255, 165, 0, ${toumeido})`;
            gameObj.ctxRader.beginPath();
            gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, gameObj.itemRadius, 0, Math.PI * 2, true);
            gameObj.ctxRader.fill();
        }
    }

    //空気の描画
    for (let [airKey, airObj] of gameObj.airMap) {

        const distanceObj = calculationBetweenTwoPoints(
            gameObj.myPlayerObj.x,
            gameObj.myPlayerObj.y,
            airObj.x,
            airObj.y,
            gameObj.fieldWidth,
            gameObj.fieldHeight,
            gameObj.raderCanvasWidth,
            gameObj.raderCanvasHeight
        );
      // レーダーの長さ以内の時
        if (distanceObj.distanceX <= (gameObj.raderCanvasWidth / 2) && distanceObj.distanceY <= (gameObj.raderCanvasHeight / 2)) {
            
            const degreeDiff = calcDegreeDiffFromRader(gameObj.deg, distanceObj.degree);
            const toumeido = calcOpacity(degreeDiff);

            gameObj.ctxRader.fillStyle = `rgb(0, 220, 255, ${toumeido})`;
            gameObj.ctxRader.beginPath();
          gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, gameObj.airRadius, 0, Math.PI * 2, true);
            gameObj.ctxRader.fill();
        }
    }

    //飛んでいるミサイルの描画
    for (let [missileId, flyingMissile] of gameObj.flyingMissilesMap) {

        const distanceObj = calculationBetweenTwoPoints(
            gameObj.myPlayerObj.x, gameObj.myPlayerObj.y,
            flyingMissile.x, flyingMissile.y,
            gameObj.fieldWidth, gameObj.fieldHeight,
            gameObj.raderCanvasWidth, gameObj.raderCanvasHeight
        );
        //キャンバスの幅＋５０でミサイルが消える
        if (
            distanceObj.distanceX <= (gameObj.raderCanvasWidth / 2 + 50) &&
            distanceObj.distanceY <= (gameObj.raderCanvasHeight / 2 + 50)
        ) {

            if (flyingMissile.emitPlayerId === gameObj.myPlayerObj.playerId) { // 自分自身のミサイルの描画

                const rotationDegree = gameObj.rotationDegreeByFlyingMissileDirection[flyingMissile.direction];
                gameObj.ctxRader.save();
                gameObj.ctxRader.translate(distanceObj.drawX, distanceObj.drawY);
                gameObj.ctxRader.rotate(getRadian(rotationDegree));
                gameObj.ctxRader.drawImage(
                    gameObj.missileImage, -gameObj.missileImage.width / 2, -gameObj.missileImage.height / 2
                );
                gameObj.ctxRader.restore();

                gameObj.ctxRader.strokeStyle = "rgba(250, 250, 250, 0.9)";
                gameObj.ctxRader.fillStyle = "rgba(250, 250, 250, 0.9)";
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.moveTo(distanceObj.drawX, distanceObj.drawY);
                gameObj.ctxRader.lineTo(distanceObj.drawX + 20, distanceObj.drawY - 20);
                gameObj.ctxRader.lineTo(distanceObj.drawX + 20 + 35, distanceObj.drawY - 20);
                gameObj.ctxRader.stroke();

                gameObj.ctxRader.font = '11px Arial';
                gameObj.ctxRader.fillText('missile', distanceObj.drawX + 20, distanceObj.drawY - 20 - 2);

            } else { // 他人のミサイルの描画

                const degreeDiff = calcDegreeDiffFromRader(gameObj.deg, distanceObj.degree);
                const toumeido = calcOpacity(degreeDiff);

                const drawRadius1 = gameObj.counter % 8 + 2 + 20;
                const clearRadius1 = drawRadius1 - 2;
                const drawRadius2 = gameObj.counter % 8 + 2 + 10;
                const clearRadius2 = drawRadius2 - 2;
                const drawRadius3 = gameObj.counter % 8 + 2 + 0;
                const clearRadius3 = drawRadius3 - 2;

                gameObj.ctxRader.fillStyle = `rgba(255, 0, 0, ${toumeido})`;
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, drawRadius1, 0, Math.PI * 2, true);
                gameObj.ctxRader.fill();

                gameObj.ctxRader.fillStyle = "rgb(0, 20, 50)";
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, clearRadius1, 0, Math.PI * 2, true);
                gameObj.ctxRader.fill();

                gameObj.ctxRader.fillStyle = `rgba(255, 0, 0, ${toumeido})`;
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, drawRadius2, 0, Math.PI * 2, true);
                gameObj.ctxRader.fill();

                gameObj.ctxRader.fillStyle = "rgb(0, 20, 50)";
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, clearRadius2, 0, Math.PI * 2, true);
                gameObj.ctxRader.fill();

                gameObj.ctxRader.fillStyle = `rgba(255, 0, 0, ${toumeido})`;
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, drawRadius3, 0, Math.PI * 2, true);
                gameObj.ctxRader.fill();

                gameObj.ctxRader.fillStyle = "rgb(0, 20, 50)";
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, clearRadius3, 0, Math.PI * 2, true);
                gameObj.ctxRader.fill();

                gameObj.ctxRader.strokeStyle = `rgba(250, 250, 250, ${toumeido})`;
                gameObj.ctxRader.fillStyle = `rgba(250, 250, 250, ${toumeido})`;
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.moveTo(distanceObj.drawX, distanceObj.drawY);
                gameObj.ctxRader.lineTo(distanceObj.drawX + 30, distanceObj.drawY - 30);
                gameObj.ctxRader.lineTo(distanceObj.drawX + 30 + 35, distanceObj.drawY - 30);
                gameObj.ctxRader.stroke();

                gameObj.ctxRader.font = '11px Arial';
                gameObj.ctxRader.fillText('missile', distanceObj.drawX + 30, distanceObj.drawY - 30 - 2);
            }
        }
    }
}

//二つの物の距離を計算する関数
function calculationBetweenTwoPoints(pX, pY, oX, oY, gameWidth, gameHeight, raderCanvasWidth, raderCanvasHeight) {
    let distanceX = 99999999;
    let distanceY = 99999999;
    let drawX = null;
    let drawY = null;

    if (pX <= oX) {
      //右から  画面サイズの中央点からの距離
        distanceX = oX - pX;
        drawX = (raderCanvasWidth / 2) + distanceX;
        //左から
        let tmpDistance = pX + gameWidth - oX;
        if (distanceX > tmpDistance) { //ワープした方が近い
            distanceX = tmpDistance;
            drawX = (raderCanvasWidth / 2) - distanceX;
        }
    } else {
      //右から  drawX:画面サイズの中央点からの距離
        distanceX = pX - oX;
        drawX = (raderCanvasWidth / 2) - distanceX;
      //左から
        let tmpDistance = oX + gameWidth - pX;
      if (distanceX > tmpDistance) { //ワープした方が近い
            distanceX = tmpDistance;
            drawX = (raderCanvasWidth / 2) + distanceX;
        }
    }

    if (pY <= oY) {
        distanceY = oY - pY;
        drawY = (raderCanvasHeight / 2) + distanceY;
      //ワープを使った時
        let tmpDistance = pY + gameHeight - oY;
        if (distanceY > tmpDistance) {
            distanceY = tmpDistance;
            drawY = (raderCanvasHeight / 2) - distanceY;
        }
    } else {
        distanceY = pY - oY;
        drawY = (raderCanvasHeight / 2) - distanceY;
      //ワープを使った時
        let tmpDistance = oY + gameHeight - pY;
        if (distanceY > tmpDistance) {
            distanceY = tmpDistance;
            drawY = (raderCanvasHeight / 2) + distanceY;
        }
    }

    const degree = calcTwoPointsDegree(drawX, drawY, raderCanvasWidth / 2, raderCanvasHeight / 2);

    //返り値はデータ型
    return {
        distanceX, //長さ
        distanceY,
        drawX,   //座標
        drawY,
        degree
    };
};

function calcDegreeDiffFromRader(degRader, degItem) {
    let diff = degRader - degItem;
    if (diff < 0) {
        diff += 360;
    }
    return diff;
}; //distanceObj.degree登録

//アイテムが60度レーダーが45度の時
//diff = -15 + 360 = 345
//345 > 270 degreeDiff = 270
//1 - 1 = 0 表示
//では　アイテムが30度レーダーが45度の時
//diff = 15
//15 > 270ではないので　degreeDiff = 15
//return 0.95 透明に近い

function calcOpacity(degreeDiff) {
    const deleteDeg = 270;
    degreeDiff = degreeDiff > deleteDeg ? deleteDeg : degreeDiff;
    return (1 - degreeDiff / deleteDeg).toFixed(2); //0~1 1は完全透明
};

function calcTwoPointsDegree(x1, y1, x2, y2) {
    const radian = Math.atan2(y2- y1, x2 - x1);
    const degree = radian * 180 / Math.PI + 180;
    return degree;
};