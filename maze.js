document.addEventListener('DOMContentLoaded', () => {
    // --- Maze Generation (DFS with Recursive Backtracking) ---
    function generateMaze(mazeWidth, mazeHeight, braid = 0.25) {
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

        // Add loops/braids to make it more complex
        if (braid > 0) {
            for (let y = 1; y < grid.length - 1; y++) {
                for (let x = 1; x < grid[0].length - 1; x++) {
                    // Check if the current cell is a wall between two paths (a potential door)
                    const isHorizontalDoor = grid[y][x - 1] === 0 && grid[y][x + 1] === 0;
                    const isVerticalDoor = grid[y - 1][x] === 0 && grid[y + 1][x] === 0;
                    
                    if (grid[y][x] === 1 && (isHorizontalDoor || isVerticalDoor)) {
                        if (Math.random() < braid) {
                            grid[y][x] = 0; // Knock down the wall
                        }
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

    // --- Game State Variables ---
    let maze;
    let player;
    let camera;
    let target = { x: 0, y: 0 };
    let isFollowing = false;
    let worldWidth, worldHeight;
    let startPos, endPos;
    const cellSize = 40;

    // --- Core Game Functions ---
    function init() {
        const mazeGridWidth = 20, mazeGridHeight = 14;
        // Generate the maze with a 25% chance of creating extra paths (braids)
        maze = generateMaze(mazeGridWidth, mazeGridHeight, 0.25);
        worldWidth = maze[0].length * cellSize;
        worldHeight = maze.length * cellSize;

        canvas.width = Math.min(800, window.innerWidth - 40);
        canvas.height = Math.min(600, window.innerHeight - 150);

        startPos = { x: 1, y: 1 };
        endPos = { x: maze[0].length - 2, y: maze.length - 2 };

        player = {
            x: startPos.x * cellSize + cellSize / 2,
            y: startPos.y * cellSize + cellSize / 2,
            radius: cellSize / 3,
        };
        
        target.x = player.x;
        target.y = player.y;
        camera = {
            x: player.x - canvas.width / 2,
            y: player.y - canvas.height / 2,
        };
        clampCamera();

        winMessage.classList.add('hidden');
        isFollowing = false;
        
        // Cancel any existing loop before starting a new one
        if (window.gameAnimationId) {
            cancelAnimationFrame(window.gameAnimationId);
        }
        gameLoop();
    }
    
    function gameLoop() {
        update();
        drawAll();
        window.gameAnimationId = requestAnimationFrame(gameLoop);
    }
    
    function update() {
        if (!isFollowing || (player.x === target.x && player.y === target.y)) return;

        const speed = 10;
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 1) {
            const dirX = dx / distance;
            const dirY = dy / distance;
            const moveX = dirX * Math.min(speed, distance);
            const moveY = dirY * Math.min(speed, distance);
            const nextX = player.x + moveX;
            const nextY = player.y + moveY;
            let moved = false;

            if (!isColliding(nextX, player.y)) {
                player.x += moveX;
                moved = true;
            }
            if (!isColliding(player.x, nextY)) {
                player.y += moveY;
                moved = true;
            }

            if (moved) {
                camera.x = player.x - canvas.width / 2;
                camera.y = player.y - canvas.height / 2;
                clampCamera();
                checkWinCondition();
            }
        }
    }

    function clampCamera() {
        camera.x = Math.max(0, Math.min(camera.x, worldWidth - canvas.width));
        camera.y = Math.max(0, Math.min(camera.y, worldHeight - canvas.height));
    }

    // --- Drawing Functions ---
    function drawAll() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        drawMaze();
        drawEndpoints();
        drawPlayer();
        ctx.restore();
    }

    function drawMaze() {
        const startCol = Math.floor(camera.x / cellSize);
        const endCol = Math.min(maze[0].length - 1, Math.ceil((camera.x + canvas.width) / cellSize));
        const startRow = Math.floor(camera.y / cellSize);
        const endRow = Math.min(maze.length - 1, Math.ceil((camera.y + canvas.height) / cellSize));
        for (let y = startRow; y <= endRow; y++) {
            for (let x = startCol; x <= endCol; x++) {
                if (maze[y][x] === 1) {
                    ctx.fillStyle = '#333';
                    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                }
            }
        }
    }

    function drawEndpoints() {
        ctx.fillStyle = '#28a745';
        ctx.fillRect(startPos.x * cellSize, startPos.y * cellSize, cellSize, cellSize);
        ctx.fillStyle = '#007bff';
        ctx.fillRect(endPos.x * cellSize, endPos.y * cellSize, cellSize, cellSize);
    }

    function drawPlayer() {
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#dc3545';
        ctx.fill();
        ctx.closePath();
    }

    // --- Event Listeners & Input ---
    restartButton.addEventListener('click', init);
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
        const dx = worldPos.x - player.x;
        const dy = worldPos.y - player.y;
        if (Math.sqrt(dx * dx + dy * dy) < player.radius * 2) {
            isFollowing = true;
            target.x = worldPos.x;
            target.y = worldPos.y;
        }
    }

    function follow(e) {
        if (isFollowing) {
            e.preventDefault();
            const worldPos = getPos(e);
            target.x = worldPos.x;
            target.y = worldPos.y;
        }
    }

    function stopFollow() { isFollowing = false; }

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        return { x: clientX - rect.left + camera.x, y: clientY - rect.top + camera.y };
    }

    // --- Win & Collision Logic ---
    function checkWinCondition() {
        const playerGridX = Math.floor(player.x / cellSize);
        const playerGridY = Math.floor(player.y / cellSize);
        if (playerGridX === endPos.x && playerGridY === endPos.y) {
            winMessage.classList.remove('hidden');
            isFollowing = false;
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
                    const closestX = Math.max(wallX, Math.min(newX, wallX + cellSize));
                    const closestY = Math.max(wallY, Math.min(newY, wallY + cellSize));
                    const dX = newX - closestX, dY = newY - closestY;
                    if ((dX * dX) + (dY * dY) < (player.radius * player.radius)) return true;
                }
            }
        }
        return false;
    }
    
    // Start the game for the first time
    init();
});