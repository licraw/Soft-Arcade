$(
function() {
  let TILE_GAP = 4;
  let LEVELS = {
    easy: { size: 3, scrambleMoves: 12 },
    medium: { size: 4, scrambleMoves: 100 },
    hard: { size: 5, scrambleMoves: 180 }
  };

  let boardSize = LEVELS.medium.size;
  let scrambleMoves = LEVELS.medium.scrambleMoves;
  let tileWidth = 0;
  let tileHeight = 0;
  let columnEdges = [];
  let rowEdges = [];
  let tiles = [];
  let gapX = 0;
  let gapY = 0;
  let hasWon = false;
  let gameStarted = false;

  function showModal(selector) {
    $(selector).removeClass("hidden");
  }

  function hideModal(selector) {
    $(selector).addClass("hidden");
  }

  function showWinModal() {
    showModal("#win-modal");
  }

  function hideWinModal() {
    hideModal("#win-modal");
  }

  function showStartMenu() {
    showModal("#start-menu");
  }

  function hideStartMenu() {
    hideModal("#start-menu");
  }

  function returnToMainMenu() {
    gameStarted = false;
    hasWon = false;
    hideWinModal();
    $("#board").addClass("hidden").empty();
    showStartMenu();
  }

  function tileLeft(x) {
    return columnEdges[x];
  }

  function tileTop(y) {
    return rowEdges[y];
  }

  function tileOuterWidth(x) {
    return columnEdges[x + 1] - columnEdges[x];
  }

  function tileOuterHeight(y) {
    return rowEdges[y + 1] - rowEdges[y];
  }

  function tileWidthAt(x) {
    return Math.max(0, tileOuterWidth(x) - TILE_GAP);
  }

  function tileHeightAt(y) {
    return Math.max(0, tileOuterHeight(y) - TILE_GAP);
  }

  function createEmptyBoard() {
    tiles = [];

    for (let y = 0; y < boardSize; y++) {
      let row = [];

      for (let x = 0; x < boardSize; x++) {
        row.push(null);
      }

      tiles.push(row);
    }

    gapX = boardSize - 1;
    gapY = boardSize - 1;
  }

  function slideTile(tile, duration) {
    let x = tile.data("x");
    let y = tile.data("y");

    tile.animate({
      top: tileTop(y) + TILE_GAP / 2,
      left: tileLeft(x) + TILE_GAP / 2
    }, duration || 200);
  }

  function down() {
    if (gapY > 0) {
      let tile = tiles[gapY - 1][gapX];
      tiles[gapY][gapX] = tile;
      tile.data("y", gapY);
      slideTile(tile);
      gapY = gapY - 1;
      tiles[gapY][gapX] = null;
      return true;
    }

    return false;
  }

  function up() {
    if (gapY < boardSize - 1) {
      let tile = tiles[gapY + 1][gapX];
      tiles[gapY][gapX] = tile;
      tile.data("y", gapY);
      slideTile(tile);
      gapY = gapY + 1;
      tiles[gapY][gapX] = null;
      return true;
    }

    return false;
  }

  function right() {
    if (gapX > 0) {
      let tile = tiles[gapY][gapX - 1];
      tiles[gapY][gapX] = tile;
      tile.data("x", gapX);
      slideTile(tile);
      gapX = gapX - 1;
      tiles[gapY][gapX] = null;
      return true;
    }

    return false;
  }

  function left() {
    if (gapX < boardSize - 1) {
      let tile = tiles[gapY][gapX + 1];
      tiles[gapY][gapX] = tile;
      tile.data("x", gapX);
      slideTile(tile);
      gapX = gapX + 1;
      tiles[gapY][gapX] = null;
      return true;
    }

    return false;
  }

  function positionTiles() {
    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        let tile = tiles[y][x];

        if (tile) {
          let tileX = tile.data("x");
          let tileY = tile.data("y");

          tile.css({
            top: tileTop(tileY) + TILE_GAP / 2,
            left: tileLeft(tileX) + TILE_GAP / 2,
            width: tileWidthAt(tileX),
            height: tileHeightAt(tileY),
            lineHeight: tileHeightAt(tileY) + "px"
          });
        }
      }
    }
  }

  function resize() {
    let boardWidth = $("#board").width();
    let boardHeight = $("#board").height();

    tileWidth = boardWidth / boardSize;
    tileHeight = boardHeight / boardSize;
    columnEdges = [];
    rowEdges = [];

    for (let i = 0; i <= boardSize; i++) {
      columnEdges[i] = Math.round(boardWidth * i / boardSize);
      rowEdges[i] = Math.round(boardHeight * i / boardSize);
    }

    $(".tile")
      .css("fontSize", 0.8 * Math.min(tileWidth, tileHeight) + "px")
      .css("borderRadius", 0.05 * Math.min(tileWidth, tileHeight));

    positionTiles();
  }

  function initTiles() {
    $("#board").empty();
    createEmptyBoard();

    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        let value = y * boardSize + x + 1;

        if (value < boardSize * boardSize) {
          let tile = $('<div class="tile">' + value + "</div>");

          $("#board").append(tile);
          tile.data("x", x).data("y", y);
          tiles[y][x] = tile;

          if (x % 2) {
            tile.css("backgroundColor", "#539fe6");
          } else {
            tile.css("backgroundColor", "#ab4b7e");
          }
        }
      }
    }
  }

  function scramble() {
    for (let i = 0; i < scrambleMoves; i++) {
      let r = Math.random();

      if (r < 0.25) {
        up();
      } else if (r < 0.5) {
        down();
      } else if (r < 0.75) {
        left();
      } else {
        right();
      }
    }
  }

  function isSolved() {
    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        let expectedValue = y * boardSize + x + 1;
        let tile = tiles[y][x];

        if (x === boardSize - 1 && y === boardSize - 1) {
          if (tile !== null) {
            return false;
          }
        } else if (!tile || parseInt(tile.text(), 10) !== expectedValue) {
          return false;
        }
      }
    }

    return true;
  }

  function maybeShowWinModal() {
    if (!hasWon && isSolved()) {
      hasWon = true;
      showWinModal();
    }
  }

  function startGame(levelName) {
    let level = LEVELS[levelName] || LEVELS.medium;

    boardSize = level.size;
    scrambleMoves = level.scrambleMoves;
    hasWon = false;
    gameStarted = true;

    hideWinModal();
    hideStartMenu();
    $("#board").removeClass("hidden");

    initTiles();
    resize();
    scramble();
    positionTiles();
  }

  function keydown(event) {
    let moved = false;

    if (!gameStarted || hasWon) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }

    switch (event.which) {
      case 38:
        moved = up();
        break;
      case 37:
        moved = left();
        break;
      case 39:
        moved = right();
        break;
      case 40:
        moved = down();
        break;
      default:
        return;
    }

    if (moved) {
      maybeShowWinModal();
    }

    event.stopPropagation();
    event.preventDefault();
  }

  return function() {
    $(window).resize(function() {
      if (gameStarted) {
        resize();
      }
    });

    $(document).keydown(keydown);
    $("#win-modal-close").click(returnToMainMenu);
    $("#win-modal").click(function(event) {
      if (event.target === this) {
        returnToMainMenu();
      }
    });
    $(".level-button").click(function() {
      startGame($(this).data("level"));
    });

    $("#board").addClass("hidden");
    showStartMenu();
  };
}()
);
