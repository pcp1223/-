document.addEventListener('DOMContentLoaded', () => {
    // --- Maze Generation (DFS with Recursive Backtracking) ---
    function generateMaze(mazeWidth, mazeHeight, braid = 0.15) {
        const grid = Array(mazeHeight * 2 + 1).fill(0).map(() => Array(mazeWidth * 2 + 1).fill(1));
        function isValid(y, x) { return y >= 0 && y < grid.length && x >= 0 && x < grid[0].length; }
        const directions = [[0, 2], [2, 0], [0, -2], [-2, 0]];
        let startY = 1, startX = 1;
        const stack = [{ y: startY, x: startX }];
        grid[startY][startX] = 0;
        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const unvisitedNeighbors = [];
            for (const [dy, dx] of directions) {
                const nextY = current.y + dy, nextX = current.x + dx;
                if (isValid(nextY, nextX) && grid[nextY][nextX] === 1) {
                    unvisitedNeighbors.push({ y: nextY, x: nextX });
                }
            }
            if (unvisitedNeighbors.length > 0) {
                const nextCell = unvisitedNeighbors[Math.floor(Math.random() * unvisitedNeighbors.length)];
                grid[nextCell.y][nextCell.x] = 0;
                grid[current.y + (nextCell.y - current.y) / 2][current.x + (nextCell.x - current.x) / 2] = 0;
                stack.push(nextCell);
            } else {
                stack.pop();
            }
        }
        if (braid > 0) {
            for (let y = 1; y < grid.length - 1; y++) {
                for (let x = 1; x < grid[0].length - 1; x++) {
                    const isHorizontalDoor = grid[y][x - 1] === 0 && grid[y][x + 1] === 0;
                    const isVerticalDoor = grid[y - 1][x] === 0 && grid[y + 1][x] === 0;
                    if (grid[y][x] === 1 && (isHorizontalDoor || isVerticalDoor)) {
                        if (Math.random() < braid) { grid[y][x] = 0; }
                    }
                }
            }
        }
        return grid;
    }

    // --- DOM Elements ---
    const canvas = document.getElementById('maze-canvas');
    const ctx = canvas.getContext('2d');
    const winMessage = document.getElementById('win-message');
    const restartButton = document.getElementById('restart-button');
    const characterSelectModal = document.getElementById('character-select-modal');
    const gameContainer = document.getElementById('game-container');
    const charSelectButtons = document.querySelectorAll('.char-select-btn');
    const imageModal = document.getElementById('image-modal');
    const eventImage = document.getElementById('event-image');
    const questionModal = document.getElementById('question-modal');
    const questionText = document.getElementById('question-text');
    const answerInput = document.getElementById('answer-input');
    const submitAnswerButton = document.getElementById('submit-answer-button');
    const feedbackText = document.getElementById('feedback-text');
    const infoModal = document.getElementById('info-modal');
    const infoText = document.getElementById('info-text');
    const infoCloseBtn = document.getElementById('info-close-btn');

    // --- Game State Variables ---
    let maze, player, camera, target = { x: 0, y: 0 }, isFollowing = false;
    let worldWidth, worldHeight, startPos, endPos;
    const cellSize = 40;
    
    let selectedCharacterName = 'eddie';
    const imagePaths = { eddie: 'eddie.png', murphy: 'murphy.png', dog: 'dog.png', master01: 'master01.png', dog02: 'dog02.png' };
    const loadedImages = {};
    let dogItem;
    let mathChallenge = { active: false, attempts: 0, question: '', answer: 0 };

    // --- Image Preloading ---
    function preloadImages(callback) {
        let loadedCount = 0;
        const imageKeys = Object.keys(imagePaths);
        const totalImages = imageKeys.length;
        if (totalImages === 0) { callback(); return; }
        imageKeys.forEach(key => {
            const img = new Image();
            img.src = imagePaths[key];
            img.onload = () => {
                loadedCount++;
                loadedImages[key] = img;
                if (loadedCount === totalImages) callback();
            };
            img.onerror = () => {
                loadedCount++;
                console.error(`Failed to load image: ${imagePaths[key]}`);
                if (loadedCount === totalImages) callback();
            };
        });
    }
    
    // --- Core Game Functions ---
    function setupApplication() {
        charSelectButtons.forEach(button => button.disabled = true);
        preloadImages(() => {
            charSelectButtons.forEach(button => button.disabled = false);
            gameContainer.style.display = 'none';
            characterSelectModal.style.display = 'flex';
            winMessage.style.display = 'none';
            imageModal.style.display = 'none';
            questionModal.style.display = 'none';
            infoModal.style.display = 'none';
        });
    }

    function startGame(characterName) {
        selectedCharacterName = characterName;
        characterSelectModal.style.display = 'none';
        gameContainer.style.display = 'block';

        const mazeGridWidth = 20, mazeGridHeight = 14;
        maze = generateMaze(mazeGridWidth, mazeGridHeight, 0.15);
        worldWidth = maze[0].length * cellSize;
        worldHeight = maze.length * cellSize;

        canvas.width = Math.min(800, window.innerWidth - 40);
        canvas.height = Math.min(600, window.innerHeight - 150);

        startPos = { x: 1, y: 1 };
        endPos = { x: maze[0].length - 2, y: maze.length - 2 };
        placeDogItem();

        player = {
            x: startPos.x * cellSize + cellSize / 2,
            y: startPos.y * cellSize + cellSize / 2,
            radius: cellSize / 3,
        };
        
        target.x = player.x;
        target.y = player.y;
        camera = { x: player.x - canvas.width / 2, y: player.y - canvas.height / 2 };
        clampCamera();

        winMessage.style.display = 'none';
        isFollowing = false;
        mathChallenge.active = false;
        
        if (window.gameAnimationId) cancelAnimationFrame(window.gameAnimationId);
        gameLoop();
    }

    function placeDogItem() {
        const validPositions = [];
        for (let y = 1; y < maze.length - 1; y++) {
            for (let x = 1; x < maze[y].length - 1; x++) {
                if (maze[y][x] === 0 && (x !== startPos.x || y !== startPos.y) && (x !== endPos.x || y !== endPos.y)) {
                    validPositions.push({ x, y });
                }
            }
        }
        if (validPositions.length > 0) {
            const pos = validPositions[Math.floor(Math.random() * validPositions.length)];
            dogItem = {
                gridX: pos.x, gridY: pos.y,
                x: pos.x * cellSize + cellSize / 2, y: pos.y * cellSize + cellSize / 2,
                radius: cellSize / 3, collected: false,
            };
        } else {
            dogItem = null; // No place for the dog
        }
    }
    
    function gameLoop() {
        update();
        drawAll();
        window.gameAnimationId = requestAnimationFrame(gameLoop);
    }
    
    function update() {
        if (!isFollowing || (player.x === target.x && player.y === target.y) || mathChallenge.active) return;
        const speed = 10;
        const dx = target.x - player.x, dy = target.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 1) {
            const dirX = dx / distance, dirY = dy / distance;
            const moveX = dirX * Math.min(speed, distance), moveY = dirY * Math.min(speed, distance);
            let moved = false;
            if (!isColliding(player.x + moveX, player.y)) { player.x += moveX; moved = true; }
            if (!isColliding(player.x, player.y + moveY)) { player.y += moveY; moved = true; }
            if (moved) {
                camera.x = player.x - canvas.width / 2;
                camera.y = player.y - canvas.height / 2;
                clampCamera();
                checkWinCondition();
                checkDogCollision();
            }
        }
    }

    function clampCamera() {
        camera.x = Math.max(0, Math.min(camera.x, worldWidth - canvas.width));
        camera.y = Math.max(0, Math.min(camera.y, worldHeight - canvas.height));
    }

    // --- Event Logic ---
    function checkDogCollision() {
        if (!dogItem || dogItem.collected) return;
        const dx = player.x - dogItem.x, dy = player.y - dogItem.y;
        if (Math.sqrt(dx * dx + dy * dy) < player.radius + dogItem.radius) {
            dogItem.collected = true;
            triggerDogEvent();
        }
    }

    function triggerDogEvent() {
        isFollowing = false;
        mathChallenge.active = true;
        eventImage.src = loadedImages['master01'].src;
        imageModal.style.display = 'flex';
        setTimeout(() => {
            imageModal.style.display = 'none';
            askMathQuestion();
        }, 2000);
    }

    function askMathQuestion() {
        mathChallenge.attempts = 0;
        generateMathQuestion();
        questionModal.style.display = 'flex';
        answerInput.value = '';
        feedbackText.textContent = '';
        answerInput.focus();
    }

    function generateMathQuestion() {
        const num1 = Math.floor(Math.random() * 900) + 100, num2 = Math.floor(Math.random() * 900) + 100;
        if (Math.random() > 0.5) {
            mathChallenge.question = `${num1} + ${num2} = ?`;
            mathChallenge.answer = num1 + num2;
        } else {
            const max = Math.max(num1, num2), min = Math.min(num1, num2);
            mathChallenge.question = `${max} - ${min} = ?`;
            mathChallenge.answer = max - min;
        }
        questionText.textContent = mathChallenge.question;
    }

    function checkMathAnswer() {
        const playerAnswer = parseInt(answerInput.value, 10);
        if (isNaN(playerAnswer)) {
            feedbackText.textContent = '請輸入一個數字。';
            return;
        }
        if (playerAnswer === mathChallenge.answer) {
            questionModal.style.display = 'none';
            eventImage.src = loadedImages['dog02'].src;
            imageModal.style.display = 'flex';
            setTimeout(() => {
                imageModal.style.display = 'none';
                mathChallenge.active = false;
            }, 2000);
        } else {
            mathChallenge.attempts++;
            answerInput.value = '';
            if (mathChallenge.attempts < 2) {
                feedbackText.textContent = '答錯了，再試一次！';
                generateMathQuestion();
            } else {
                gameOver('答錯兩次，遊戲結束！');
            }
        }
    }
    
    function gameOver(message) {
        isFollowing = false;
        mathChallenge.active = true;
        questionModal.style.display = 'none';
        winMessage.querySelector('p').textContent = message;
        winMessage.querySelector('button').textContent = '重新玩一次';
        winMessage.style.display = 'block';
    }

    // --- Drawing ---
    function drawAll() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        drawMaze();
        drawEndpoints();
        drawDogItem();
        drawPlayer();
        ctx.restore();
    }

    function drawMaze() {
        const startCol = Math.floor(camera.x / cellSize), endCol = Math.min(maze[0].length - 1, Math.ceil((camera.x + canvas.width) / cellSize));
        const startRow = Math.floor(camera.y / cellSize), endRow = Math.min(maze.length - 1, Math.ceil((camera.y + canvas.height) / cellSize));
        for (let y = startRow; y <= endRow; y++) {
            for (let x = startCol; x <= endCol; x++) {
                if (maze[y][x] === 1) { ctx.fillStyle = '#333'; ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize); }
            }
        }
    }

    function drawEndpoints() {
        ctx.fillStyle = '#28a745';
        ctx.fillRect(startPos.x * cellSize, startPos.y * cellSize, cellSize, cellSize);
        ctx.fillStyle = '#007bff';
        ctx.fillRect(endPos.x * cellSize, endPos.y * cellSize, cellSize, cellSize);
    }

    function drawDogItem() {
        if (dogItem && !dogItem.collected) {
            const imageToDraw = loadedImages['dog'];
            if (imageToDraw) {
                const imageSize = cellSize * 0.8;
                ctx.drawImage(imageToDraw, dogItem.x - imageSize / 2, dogItem.y - imageSize / 2, imageSize, imageSize);
            }
        }
    }

    function drawPlayer() {
        const imageToDraw = loadedImages[selectedCharacterName];
        if (imageToDraw) {
            const imageSize = player.radius * 2.5 * 1.5;
            ctx.drawImage(imageToDraw, player.x - imageSize / 2, player.y - imageSize / 2, imageSize, imageSize);
        } else {
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#dc3545';
            ctx.fill();
            ctx.closePath();
        }
    }

    // --- Event Listeners & Input ---
    charSelectButtons.forEach(button => button.addEventListener('click', () => startGame(button.dataset.character)));
    restartButton.addEventListener('click', () => startGame(selectedCharacterName));
    submitAnswerButton.addEventListener('click', checkMathAnswer);
    answerInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') checkMathAnswer(); });
    infoCloseBtn.addEventListener('click', () => {
        infoModal.style.display = 'none';
    });

    canvas.addEventListener('mousedown', startFollow);
    canvas.addEventListener('mouseup', stopFollow);
    canvas.addEventListener('mousemove', follow);
    canvas.addEventListener('mouseleave', stopFollow);
    canvas.addEventListener('touchstart', startFollow, { passive: false });
    canvas.addEventListener('touchend', stopFollow, { passive: false });
    canvas.addEventListener('touchmove', follow, { passive: false });

    function startFollow(e) {
        e.preventDefault();
        const worldPos = getPos(e);
        const dx = worldPos.x - player.x, dy = worldPos.y - player.y;
        if (Math.sqrt(dx * dx + dy * dy) < player.radius * 2) {
            isFollowing = true;
            target.x = worldPos.x;
            target.y = worldPos.y;
        }
    }

    function follow(e) { if (isFollowing) { e.preventDefault(); const worldPos = getPos(e); target.x = worldPos.x; target.y = worldPos.y; } }
    function stopFollow() { isFollowing = false; }
    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if (e.touches && e.touches.length > 0) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
        else { clientX = e.clientX; clientY = e.clientY; }
        return { x: clientX - rect.left + camera.x, y: clientY - rect.top + camera.y };
    }

    // --- Win & Collision Logic ---
    function checkWinCondition() {
        const playerGridX = Math.floor(player.x / cellSize);
        const playerGridY = Math.floor(player.y / cellSize);
        if (playerGridX === endPos.x && playerGridY === endPos.y) {
            if (dogItem && !dogItem.collected) {
                // Player reached the end without the dog
                infoText.textContent = '你沒有救到狗狗喔，再去找看看';
                infoModal.style.display = 'flex';
            } else {
                // Yes, real win
                winMessage.querySelector('p').textContent = '恭喜你！成功到達終點！';
                winMessage.querySelector('button').textContent = '重新開始';
                winMessage.style.display = 'block';
                isFollowing = false;
            }
        }
    }

    function isColliding(newX, newY) {
        const minX = newX - player.radius, maxX = newX + player.radius;
        const minY = newY - player.radius, maxY = newY + player.radius;
        const startCol = Math.floor(minX / cellSize), endCol = Math.floor(maxX / cellSize);
        const startRow = Math.floor(minY / cellSize), endRow = Math.floor(maxY / cellSize);
        for (let y = startRow; y <= endRow; y++) {
            for (let x = startCol; x <= endCol; x++) {
                if (y >= 0 && y < maze.length && x >= 0 && x < maze[y].length && maze[y][x] === 1) {
                    const wallX = x * cellSize, wallY = y * cellSize;
                    const closestX = Math.max(wallX, Math.min(newX, wallX + cellSize)), closestY = Math.max(wallY, Math.min(newY, wallY + cellSize));
                    const dX = newX - closestX, dY = newY - closestY;
                    if ((dX * dX) + (dY * dY) < (player.radius * player.radius)) return true;
                }
            }
        }
        return false;
    }
    
    // --- Application Start ---
    setupApplication();
});