document.addEventListener('DOMContentLoaded', () => {
    // --- Maze Generation (DFS with Recursive Backtracking) ---
    function generateMaze(mazeWidth, mazeHeight, braid = 0.15) {
        const grid = Array(mazeHeight * 2 + 1).fill(0).map(() => Array(mazeWidth * 2 + 1).fill(1));
        function isValid(y, x) { return y >= 0 && y < grid.length && x >= 0 && x < grid[0].length; } // Fixed: grid[0].length
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
                grid[current.y + (nextCell.y - current.y) / 2][current.x + (nextCell.x - current.x) / 2] = 0; // Fixed: nextCell.x
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
    const mazeSizeButtons = document.querySelectorAll('.maze-size-btn');
    const startGameBtn = document.getElementById('start-game-btn');
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
    const timerDisplay = document.getElementById('timer-display');
    const gameTimer = document.getElementById('game-timer');

    // --- Game State Variables ---
    let maze, player, camera, target = { x: 0, y: 0 }, isFollowing = false;
    let worldWidth, worldHeight, startPos, endPos;
    const cellSize = 40;
    
    let selectedCharacter = null; // Corrected variable name
    let selectedMazeSize = null;
    const imagePaths = { eddie: 'eddie.png', murphy: 'murphy.png', dog: 'dog.png', master01: 'master01.png', dog02: 'dog02.png', wall: 'wall.png', goal: 'goal.jpg', door: 'do.png', floor: 'floor.png', start: 'start.png' }; // Added start
    const loadedImages = {};
    let dogItem;
    let mathChallenge = { active: false, attempts: 0, question: '', answer: 0 };
    let gameStartTime = null; // For timer
    let elapsedTime = 0; // For timer

    // --- Image Preloading ---
    function preloadImages(callback) {
        let loadedCount = 0;
        let hasPreloadError = false; // Flag to track if any image failed to load
        const imageKeys = Object.keys(imagePaths);
        const totalImages = imageKeys.length;

        if (totalImages === 0) { callback(hasPreloadError); return; } // Pass error state to callback

        console.log("Preloading started for:", imageKeys);

        imageKeys.forEach(key => {
            const img = new Image();
            img.src = imagePaths[key];
            img.onload = () => {
                loadedCount++;
                loadedImages[key] = img;
                console.log(`Preload: Successfully loaded ${key}: ${imagePaths[key]}`);
                if (loadedCount === totalImages) {
                    console.log("Preload: All images processed.");
                    callback(hasPreloadError); // Pass error state to callback
                }
            };
            img.onerror = () => {
                hasPreloadError = true; // Mark that an error occurred
                loadedCount++;
                console.error(`Preload: Failed to load image: ${key} at ${imagePaths[key]}`);
                if (loadedCount === totalImages) {
                    console.log("Preload: All images processed (with errors).");
                    callback(hasPreloadError); // Pass error state to callback
                }
            };
        });
    }
    
    // --- Core Game Functions ---
    function setupApplication() {
        // Reset selections and disable start button
        selectedCharacter = null;
        selectedMazeSize = null;
        startGameBtn.disabled = true;

        // Visual reset for character buttons
        charSelectButtons.forEach(button => button.classList.remove('selected'));
        // Visual reset for maze size buttons
        mazeSizeButtons.forEach(button => button.classList.remove('selected'));

        // Disable all selection buttons while preloading. Enabled in preloadImages callback.
        charSelectButtons.forEach(button => button.disabled = true);
        mazeSizeButtons.forEach(button => button.disabled = true);
        
        preloadImages((hasError) => { // Receive the error flag
            if (hasError) {
                // Display a prominent error message to the user
                infoText.textContent = '遊戲資源載入失敗！請檢查圖片檔案名稱或路徑。';
                infoModal.style.display = 'flex';
                // Disable everything so game can't start
                charSelectButtons.forEach(button => button.disabled = true);
                mazeSizeButtons.forEach(button => button.disabled = true);
                startGameBtn.disabled = true;
                return; // Stop further setup
            }

            // Enable selection buttons once images are loaded
            charSelectButtons.forEach(button => button.disabled = false);
            mazeSizeButtons.forEach(button => button.disabled = false);

            gameContainer.style.display = 'none';
            characterSelectModal.style.display = 'flex'; // Show character select
            winMessage.style.display = 'none';
            imageModal.style.display = 'none';
            questionModal.style.display = 'none';
            infoModal.style.display = 'none';
            timerDisplay.style.display = 'none'; // Ensure timer is hidden initially
        });
    }

    function updateStartButtonState() {
        startGameBtn.disabled = !(selectedCharacter && selectedMazeSize);
    }

    function selectCharacter(characterName, button) {
        selectedCharacter = characterName;
        charSelectButtons.forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');
        updateStartButtonState();
    }

    function selectMazeSize(size, button) {
        selectedMazeSize = size;
        mazeSizeButtons.forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');
        updateStartButtonState();
    }

    function finalizeGameStart() {
        if (!selectedCharacter || !selectedMazeSize) {
            console.error("Character or Maze Size not selected!");
            return;
        }

        characterSelectModal.style.display = 'none';
        gameContainer.style.display = 'block';

        let mazeGridWidth, mazeGridHeight;
        switch(selectedMazeSize) {
            case 'small':
                mazeGridWidth = 15; mazeGridHeight = 10;
                break;
            case 'medium':
                mazeGridWidth = 20; mazeGridHeight = 14;
                break;
            case 'large':
                mazeGridWidth = 25; mazeGridHeight = 18;
                break;
            default:
                mazeGridWidth = 20; mazeGridHeight = 14; // Default to medium
        }
        
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
        
        gameStartTime = null; // Reset timer
        elapsedTime = 0;
        updateTimerDisplay(); // Display 00:00
        timerDisplay.style.display = 'block'; // Show timer

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
        
        // Timer update
        if (gameStartTime === null) {
            gameStartTime = performance.now();
        }
        elapsedTime = performance.now() - gameStartTime;
        updateTimerDisplay();

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

    // --- Timer Display ---
    function updateTimerDisplay() {
        const totalSeconds = Math.floor(elapsedTime / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const formattedTime = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        gameTimer.textContent = formattedTime;
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
        const num1 = Math.floor(Math.random() * 90) + 10, num2 = Math.floor(Math.random() * 90) + 10;
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
                isFollowing = true; // Resume player movement
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
        winMessage.querySelector('button').textContent = '回到選角';
        winMessage.style.display = 'block';
        gameStartTime = null; // Stop timer
        timerDisplay.style.display = 'none'; // Hide timer
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
                // Changed to draw wall image
                if (maze[y][x] === 1) {
                    const imageToDraw = loadedImages['wall']; // Get the wall image
                    if (imageToDraw) {
                        ctx.drawImage(imageToDraw, x * cellSize, y * cellSize, cellSize, cellSize);
                    } else {
                        // Fallback to solid color if image not loaded
                        ctx.fillStyle = '#333'; // Dark grey for walls
                        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                    }
                } else if (maze[y][x] === 0) { // Path cells
                    const floorImage = loadedImages['floor'];
                    if (floorImage) {
                        ctx.drawImage(floorImage, x * cellSize, y * cellSize, cellSize, cellSize);
                    } else {
                        // Fallback to white color if image not loaded
                        ctx.fillStyle = '#ffffff'; // White for floor
                        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                    }
                }
            }
        }
    }

    function drawEndpoints() {
        // Start Point (Image)
        const startImage = loadedImages['start'];
        if (startImage) {
            const enlargedSize = cellSize * 3;
            // To center a 3x image in a 1x cell: offset = (1 - 3)/2 = -1 cell
            const drawX = startPos.x * cellSize - cellSize; 
            const drawY = startPos.y * cellSize - cellSize;
            ctx.drawImage(startImage, drawX, drawY, enlargedSize, enlargedSize);
        } else {
            // Fallback to green square if image not loaded
            ctx.fillStyle = '#28a745';
            ctx.fillRect(startPos.x * cellSize, startPos.y * cellSize, cellSize, cellSize);
        }
        
        // End Point (Door image)
        const doorImage = loadedImages['door'];
        // Debug logs for doorImage removed as issue should be resolved
        if (doorImage) {
            // Draw enlarged door, centered in its original cell area
            const enlargedSize = cellSize * 2;
            const drawX = endPos.x * cellSize - cellSize / 2; // Adjust x to center enlarged image
            const drawY = endPos.y * cellSize - cellSize / 2; // Adjust y to center enlarged image
            ctx.drawImage(doorImage, drawX, drawY, enlargedSize, enlargedSize);
        } else {
            // Fallback to blue square if image not loaded
            ctx.fillStyle = '#007bff';
            ctx.fillRect(endPos.x * cellSize, endPos.y * cellSize, cellSize, cellSize);
        }
    }

    function drawDogItem() {
        if (dogItem && !dogItem.collected) {
            const imageToDraw = loadedImages['dog'];
            if (imageToDraw) {
                const imageSize = cellSize * 0.8 * 2; // Enlarged by 2 times
                ctx.drawImage(imageToDraw, dogItem.x - imageSize / 2, dogItem.y - imageSize / 2, imageSize, imageSize);
            }
        }
    }

    function drawPlayer() {
        const imageToDraw = loadedImages[selectedCharacter]; // Corrected reference
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
    charSelectButtons.forEach(button => button.addEventListener('click', (e) => selectCharacter(e.currentTarget.dataset.character, e.currentTarget)));
    mazeSizeButtons.forEach(button => button.addEventListener('click', (e) => selectMazeSize(e.currentTarget.dataset.size, e.currentTarget)));
    startGameBtn.addEventListener('click', finalizeGameStart);
    restartButton.addEventListener('click', () => setupApplication());
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
        const playerGridX = Math.floor(player.x / cellSize), playerGridY = Math.floor(player.y / cellSize);
        if (playerGridX === endPos.x && playerGridY === endPos.y) {
            if (dogItem && !dogItem.collected) {
                // Player reached the end without the dog
                infoText.textContent = '你沒有救到狗狗喔，再去找看看';
                infoModal.style.display = 'flex';
            } else {
                // Yes, real win
                isFollowing = false;
                gameStartTime = null; // Stop timer
                timerDisplay.style.display = 'none'; // Hide timer
                
                eventImage.src = loadedImages['goal'].src;
                imageModal.style.display = 'flex';
                
                setTimeout(() => {
                    imageModal.style.display = 'none';
                    winMessage.querySelector('p').textContent = `恭喜過關！耗時: ${gameTimer.textContent}`; // Changed to '過關'
                    winMessage.querySelector('button').textContent = '重新開始'; // Changed to '重新開始'
                    winMessage.style.display = 'block';
                }, 2000); // Display goal.jpg for 2 seconds
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