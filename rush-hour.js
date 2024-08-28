// credits for this code go to: https://github.com/fogleman/rush

// Constants
let UnusableHeight = 72 + // timer
  72 + // footer
  72 + // links
  24 * 5;

function parseHash() {
    try {
        let hash = location.hash.substring(1);
        let i = hash.indexOf('/');
        if (i < 0) {
            return hash
        }
        return null
    } catch (e) {
        return null
    }
}


class Piece {
    constructor(position, size, stride) {
        this.position = position;
        this.size = size;
        this.stride = stride;
        this.fixed = size === 1;
    }
    move(steps) {
        this.position += this.stride * steps;
    }
    draw(p5, boardSize, offset) {
        offset = offset || 0;
        let i0 = this.position;
        let i1 = i0 + this.stride * (this.size - 1);
        let x0 = Math.floor(i0 % boardSize);
        let y0 = Math.floor(i0 / boardSize);
        let x1 = Math.floor(i1 % boardSize);
        let y1 = Math.floor(i1 / boardSize);
        let p = 0.1;
        let x = x0 + p;
        let y = y0 + p;
        let w = x1 - x0 + 1 - p * 2;
        let h = y1 - y0 + 1 - p * 2;
        if (this.stride === 1) {
            x += offset;
        } else {
            y += offset;
        }
        p5.rect(x, y, w, h, 0.1);
    }
    pickAxis(point) {
        if (this.stride === 1) {
            return point.x;
        } else {
            return point.y;
        }
    }
}


class Move {
    constructor(piece, steps) {
        this.piece = piece;
        this.steps = steps;
    }
}

class Board {
    constructor(desc) {
        this.pieces = [];

        // determine board size
        this.size = Math.floor(Math.sqrt(desc.length));
        if (this.size === 0) {
            throw "board cannot be empty";
        }

        this.size2 = this.size * this.size;
        if (this.size2 !== desc.length) {
            throw "boards must be square";
        }

        // parse string
        let positions = new Map();
        for (let i = 0; i < desc.length; i++) {
            let label = desc.charAt(i);
            if (!positions.has(label)) {
                positions.set(label, []);
            }
            positions.get(label).push(i);
        }

        // sort piece labels
        let labels = Array.from(positions.keys());
        labels.sort();

        // add pieces
        for (let label of labels) {
            if (label === '.' || label === 'o') {
                continue;
            }
            if (label === 'x') {
                continue;
            }
            let ps = positions.get(label);
            if (ps.length < 2) {
                throw "piece size must be >= 2";
            }
            let stride = ps[1] - ps[0];
            if (stride !== 1 && stride !== this.size) {
                throw "invalid piece shape";
            }
            for (let i = 2; i < ps.length; i++) {
                if (ps[i] - ps[i - 1] !== stride) {
                    throw "invalid piece shape";
                }
            }
            let piece = new Piece(ps[0], ps.length, stride);
            this.addPiece(piece);
        }

        // add walls
        if (positions.has('x')) {
            let ps = positions.get('x');
            for (let p of ps) {
                let piece = new Piece(p, 1, 1);
                this.addPiece(piece);
            }
        }

        // compute some stuff
        this.primaryRow = 0;
        if (this.pieces.length !== 0) {
            this.primaryRow = Math.floor(this.pieces[0].position / this.size);
        }
    }
    addPiece(piece) {
        this.pieces.push(piece);
    }
    doMove(move) {
        this.pieces[move.piece].move(move.steps);
    }
    undoMove(move) {
        this.pieces[move.piece].move(-move.steps);
    }
    isSolved() {
        if (this.pieces.length === 0) {
            return false;
        }
        let piece = this.pieces[0];
        let x = Math.floor(piece.position % this.size);
        return x + piece.size === this.size;
    }
    pieceAt(index) {
        for (let i = 0; i < this.pieces.length; i++) {
            let piece = this.pieces[i];
            let p = piece.position;
            for (let j = 0; j < piece.size; j++) {
                if (p === index) {
                    return i;
                }
                p += piece.stride;
            }
        }
        return -1;
    }
    isOccupied(index) {
        return this.pieceAt(index) >= 0;
    }
    moves() {
        let moves = [];
        let size = this.size;
        for (let i = 0; i < this.pieces.length; i++) {
            let piece = this.pieces[i];
            if (piece.fixed) {
                continue;
            }
            let reverseSteps;
            let forwardSteps;
            if (piece.stride == 1) {
                let x = Math.floor(piece.position % size);
                reverseSteps = -x;
                forwardSteps = size - piece.size - x;
            } else {
                let y = Math.floor(piece.position / size);
                reverseSteps = -y;
                forwardSteps = size - piece.size - y;
            }
            let idx = piece.position - piece.stride;
            for (let steps = -1; steps >= reverseSteps; steps--) {
                if (this.isOccupied(idx)) {
                    break;
                }
                moves.push(new Move(i, steps));
                idx -= piece.stride;
            }
            idx = piece.position + piece.size * piece.stride;
            for (let steps = 1; steps <= forwardSteps; steps++) {
                if (this.isOccupied(idx)) {
                    break;
                }
                moves.push(new Move(i, steps));
                idx += piece.stride;
            }
        }
        return moves;
    }
}


class View {
    constructor() {
        this.board = new Board("BCCoEEBoDFFNAADGoNoHoGMMoHoGLooHKKLo");
        this.movesRequired = 60;
        this.dragPiece = -1;
        this.dragAnchor = null;
        this.dragDelta = null;
        this.dragMin = 0;
        this.dragMax = 0;
        this.undoStack = [];

        this.backgroundColor = "#FFFFFF";
        this.boardColor = "#3d3d3d";
        this.gridLineColor = "#464646";
        this.primaryPieceColor = "#DFFF00";
        this.pieceColor = "#338899";
        this.pieceColorHorizontal = "#02dc60";
        this.pieceColorVertical = "#fe1e09";
        this.pieceOutlineColor = "#222222";
        this.wallColor = "#222222";
        this.wallBoltColor = "#AAAAAA";
    }
    bind(p5) {
        this.p5 = p5;
    }
    setBoard(board, movesRequired) {
        this.board = board;
        this.movesRequired = movesRequired || -1;
        this.undoStack = [];
        this.changed();
    }
    parseHash() {
        try {
            let hash = location.hash.substring(1);
            let i = hash.indexOf('/');
            if (i < 0) {
                let desc = hash;
                if (desc !== "" && desc !== null) {
                  this.setBoard(new Board(desc));
                }
            } else {
                let desc = hash.substring(0, i);
                let movesRequired = parseInt(hash.substring(i + 1));
                this.setBoard(new Board(desc), movesRequired);
            }
        }
        catch (e) {
          console.log("error: " + e);
        }
    }
    computeScale() {
        let p5 = this.p5;
        let board = this.board;
        let xscale = (p5.width / board.size) * 0.9;
        let yscale = (p5.height / board.size) * 0.99;
        return Math.min(xscale, yscale);
    }
    mouseVector() {
        let p5 = this.p5;
        let board = this.board;
        let mx = p5.mouseX || p5.touchX;
        let my = p5.mouseY || p5.touchY;
        let scale = this.computeScale();
        let x = (mx - p5.width / 2) / scale + board.size / 2;
        let y = (my - p5.height / 2) / scale + board.size / 2;
        return p5.createVector(x, y);
    }
    mouseIndex() {
        let board = this.board;
        let p = this.mouseVector();
        let x = Math.floor(p.x);
        let y = Math.floor(p.y);
        return y * board.size + x;
    }
    mousePressed() {
        let p5 = this.p5;
        let board = this.board;
        this.dragAnchor = this.mouseVector();
        this.dragDelta = p5.createVector(0, 0);
        this.dragPiece = board.pieceAt(this.mouseIndex());
        if (this.dragPiece < 0) {
            return;
        }
        let piece = board.pieces[this.dragPiece];
        // can't move walls
        if (piece.fixed) {
            this.dragPiece = -1;
            return;
        }
        // determine max range
        this.dragMin = 0;
        this.dragMax = 0;
        for (let move of board.moves()) {
            if (move.piece === this.dragPiece) {
                this.dragMin = Math.min(this.dragMin, move.steps);
                this.dragMax = Math.max(this.dragMax, move.steps);
            }
        }
    }
    mouseReleased() {
        let p5 = this.p5;
        let board = this.board;
        if (this.dragPiece < 0) {
            return;
        }
        this.dragDelta = p5.Vector.sub(this.mouseVector(), this.dragAnchor);
        let piece = board.pieces[this.dragPiece];
        let steps = Math.round(piece.pickAxis(this.dragDelta));
        steps = Math.min(steps, this.dragMax);
        steps = Math.max(steps, this.dragMin);
        for (let move of board.moves()) {
            if (move.piece === this.dragPiece && move.steps === steps) {
                board.doMove(move);
                this.undoStack.push(move);
                this.changed();
                break;
            }
        }
        this.dragPiece = -1;
    }
    mouseDragged() {
        let p5 = this.p5;
        if (this.dragPiece < 0) {
            return;
        }
        this.dragDelta = p5.Vector.sub(this.mouseVector(), this.dragAnchor);
    }
    touchStarted() {
        this.mousePressed();
        return false;
    }
    touchEnded() {
        this.mouseReleased();
        return false;
    }
    touchMoved() {
        this.mouseDragged();
        return false;
    }
    keyPressed() {
        let p5 = this.p5;
        if (p5.key === 'U') {
            this.undo();
        } else if (p5.key === 'R') {
            this.reset();
        }
    }
    reset() {
        let board = this.board;
        while (this.undoStack.length > 0) {
            let move = this.undoStack.pop();
            board.undoMove(move);
        }
        this.changed();
    }
    undo() {
        let board = this.board;
        if (this.undoStack.length > 0) {
            let move = this.undoStack.pop();
            board.undoMove(move);
        }
        this.changed();
    }
    changed() {
        $('#numMoves').text(this.undoStack.length);
        if (this.movesRequired > 0) {
            $('#movesRequired').text('/ ' + this.movesRequired);
        } else {
            $('#movesRequired').text('');
        }
    }
    setup() {
        let p5 = this.p5;
        p5.createCanvas(p5.windowWidth, p5.windowHeight - UnusableHeight);
    }
    windowResized() {
        let p5 = this.p5;
        p5.resizeCanvas(p5.windowWidth, p5.windowHeight - UnusableHeight);
    }
    draw() {
        let p5 = this.p5;
        let board = this.board;
        let size = board.size;

        p5.background(this.backgroundColor);
        p5.strokeJoin(p5.ROUND);

        let scale = this.computeScale();
        p5.resetMatrix();
        p5.translate(p5.width / 2, p5.height / 2);
        p5.scale(scale);
        p5.translate(-size / 2, -size / 2);

        // exit
        let ex = size;
        let ey = board.primaryRow + 0.5;
        let es = 0.3;
        p5.fill(this.gridLineColor);
        p5.noStroke();
        p5.beginShape();
        p5.vertex(ex, ey + es);
        p5.vertex(ex, ey - es);
        p5.vertex(ex + es, ey);
        p5.endShape(p5.CLOSE);

        // board
        p5.fill(this.boardColor);
        if (board.isSolved()) {
            if (Date.now() % 500 < 250) {
                p5.fill("#AAAAAA");
            }
        }
        p5.stroke(this.gridLineColor);
        p5.strokeWeight(0.03);
        p5.rect(0, 0, size, size, 0.03);

        // walls
        p5.noStroke();
        p5.ellipseMode(p5.RADIUS);
        for (let piece of board.pieces) {
            if (!piece.fixed) {
                continue;
            }
            let x = Math.floor(piece.position % size);
            let y = Math.floor(piece.position / size);
            p5.fill(this.wallColor);
            p5.rect(x, y, 1, 1);
            let p = 0.15;
            let r = 0.04;
            p5.fill(this.wallBoltColor);
            p5.ellipse(x + p, y + p, r);
            p5.ellipse(x + 1 - p, y + p, r);
            p5.ellipse(x + p, y + 1 - p, r);
            p5.ellipse(x + 1 - p, y + 1 - p, r);
        }

        // grid lines
        p5.stroke(this.gridLineColor);
        p5.strokeWeight(0.015);
        for (let i = 1; i < size; i++) {
            p5.line(i, 0, i, size);
            p5.line(0, i, size, i);
        }

        // pieces
        p5.stroke(this.pieceOutlineColor);
        p5.strokeWeight(0.03);
        for (let i = 0; i < board.pieces.length; i++) {
            if (i === this.dragPiece) {
                continue;
            }
            let piece = board.pieces[i];
            if (piece.fixed) {
                continue;
            }
            if (i === 0) {
                p5.fill(this.primaryPieceColor);
            } else {
                if (piece.stride === 1) {
                    p5.fill(this.pieceColorHorizontal);
                } else {
                    p5.fill(this.pieceColorVertical);
                }
            }
            piece.draw(p5, size);
        }

        // dragging
        if (this.dragPiece >= 0) {
            let piece = board.pieces[this.dragPiece];
            let offset = piece.pickAxis(this.dragDelta);
            offset = Math.min(offset, this.dragMax);
            offset = Math.max(offset, this.dragMin);
            if (this.dragPiece === 0) {
                p5.fill(this.primaryPieceColor);
            } else {
                if (piece.stride === 1) {
                    p5.fill(this.pieceColorHorizontal);
                } else {
                    p5.fill(this.pieceColorVertical);
                }
            }
            p5.stroke(this.pieceOutlineColor);
            piece.draw(p5, size, offset);
        }
    }
}

function showBoard() {
  let view = new View();

  let sketch = function(p) {
      p.Vector = p5.Vector;
      view.bind(p);
      p.draw = function() { view.draw(); }
      p.keyPressed = function() { view.keyPressed(); }
      p.mouseDragged = function() { view.mouseDragged(); }
      p.mousePressed = function() { view.mousePressed(); }
      p.mouseReleased = function() { view.mouseReleased(); }
      p.setup = function() { view.setup(); };
      p.touchEnded = function() { view.touchEnded(); }
      p.touchMoved = function() { view.touchMoved(); }
      p.touchStarted = function() { view.touchStarted(); }
      p.windowResized = function() { view.windowResized(); }
  };

  new p5(sketch, 'view');

  return view
}

let countdown;

function startCountdown(duration) {
  const timerDisplay = document.getElementById('timer');
  let timer = duration, seconds;

  countdown = setInterval(function() {
    seconds = parseInt(timer, 10);

    timerDisplay.textContent = seconds;

    if (--timer < 0) {
      clearInterval(countdown);
      timerDisplay.textContent = "Time's up!";
    }
    },
    1000
  );
}

let puzzles = {
  "2024-08-28": "oEEBooooDBCCFoDAALFoDKKLFGGIJJoHHIoo",
  "2024-08-27": "oMooCCoMBBBDoMAAEDLLKoEDJoKGFFJHHGoo",
  "2024-08-26": "ooBBCCoooDEoLAADEFLKIIEFoKJHHFoKJGGG",
  "2024-08-25": "oKKoooLLJoBBoIJAACHIFFFCHGGEoCHooEDD",
  "2024-08-24": "BCooEoBCDDEoAAGoEoHoGFFLHIIJoLKKoJoL",
  "2024-08-23": "CCoDoooBoDEEoBAAFGKLLIFGKooIHHKJJJoo",
  "2024-08-22": "oCooEEBCDDFoBCAAFGHHIoFGooIKKLJJJooL",
  "2024-08-21": "oBCCDDoBGoFEAAGoFEJHHLFoJooLMMKKKLoo",
  "2024-08-20": "CCBHHoooBGoIDAAGoIDEoGJJDEFFKoLLLoKo",
  "2024-08-19": "CoDDooCoBEEEAABFoGMKKFoGMLJJJGoLooHH",
  "2024-08-18": "oCCDEEoBoDFooBAAFGKJJHHGKoLMMMooLooo",
  "2024-08-17": "oBoCDDoBoCEooBAAEoHHGoEoooGFFKJJJooK",
  "2024-08-16": "oBBBoGooCDDGAACEFoLLLEFoMKKKFHMooJJH",
  "2024-08-15": "oBBEEEooCDFFAACDoGoMJJJGoMKoHHLLKooo",
  "2024-08-14": "ooCCCooooBDDoAABEFoIHHEFLIoJGGLKKJoo",
  "2024-08-13": "oDDEFFBCoEGoBCAAGoBKKoGoooJHHHooJooo",
  "2024-08-12": "BooFFoBEEoGHCoAAGHCDDoGoooLKKJMMLooJ",
  "2024-08-11": "ooCCCGBBDoFGAADoFHLKEEFHLKoJoHoKoJII",
  "2024-08-10": "oBoDDooBCCFGoAAEFGLKKEFoLoJIIHLoJooH",
  "2024-08-09": "ooooEEoCCDFoBAADFMBGGGFMBoHKKMJJHoLL",
  "2024-08-08": "oBCCCooBDEHHAADEoGoMFFFGoMKoJJLLKooo",
  "2024-08-07": "BoCCooBoDoFoAADEFoGGGEFKoHJJJKoHoooo",
  "2024-08-06": "BBooMoCEooMoCEAAMLDEFKKLDoFHJJDGGHoo",
  "2024-08-05": "oBCCDDoBEEEFoBAAGFLMMoGFLooXHHoKKXoo",
  "2024-08-04": "oBoooooBoCKKoAACIoEDDDIHEoFGGHooFooH",
  "2024-08-03": "oooBBBoooDCCKAADoEKGFFFEJGoLMMJHHLoo",
  "2024-08-02": "oBCCEooBDDEoAAFoELHoFMMLHGGJoLHooJKK",
  "2024-08-01": "BooCCoBooDoFBAADoFooJDEEKoJHHGKLLooG",
  "2024-07-31": "ooDoEEBBDoFGCCAAFGoKJIIHoKJooHoKLLLH",
  "2024-07-30": "BCooLLBCDDDKAAEooKooEFFKooEGHHIIIGoo",
  "2024-07-29": "BooDDoBCCCEFAALoEFooLGGFKKLIHHJJJIoo",
  "2024-07-28": "BBooEFoCDDEFoCAAEoooLoGGKKLHooJJJHoo",
  "2024-07-27": "oBBBoKooCFJKAACFJoooDFHHooDGGIoEEooI",
  "2024-07-26": "BBoooEoCCCDEKAAoDoKJIoDFoJIGGFoJoHHH",
  "2024-07-25": "BooEFFBCoEGoBCAAGHDDDoGHooLoJJooLoKK",
  "2024-07-24": "oBooDDoBCCEoAAGoEoHHGFFLIJJKoLIooKoL",
  "2024-07-23": "BBJIIoCDJoHGCDAAHGoooEoGoooEFFoooEoo",
  "2024-07-22": "BCCoEEBoDFFNAADGoNoHoGMMoHoGLooHKKLo",
  "2024-07-21": "oBoCDDEBoCFoEBAAFoGGHoFoIoHKKLIMMooL",
  "2024-07-20": "oMooCooMBBCoAAEoCoHoEFFLHGGJoLHIIJKK",
}

function hamsterUnixTime() {
  let nowUTCUnix = Date.now()
  let nowHamsterUnix = nowUTCUnix + 4 * 3600000;

  return nowHamsterUnix;
}

function hamsterBeginningOfDayUnix() {
  let nowHamsterUnix = hamsterUnixTime();

  let nowHamster = new Date(nowHamsterUnix);

  let hamsterDate = nowHamster.toISOString().split('T')[0];

  return new Date(hamsterDate + "T00:00:00.000Z").getTime();
}

function hamsterEngingOfDayUnix() {
  return hamsterBeginningOfDayUnix() + 86400000;
}

function hamsterDate() {
  let nowHamsterUnix = hamsterUnixTime();

  let nowHamster = new Date(nowHamsterUnix);

  return nowHamster.toISOString().split('T')[0];
}

function puzzleTimeLeft() {
  let nowHamsterUnix = hamsterUnixTime();

  return hamsterEngingOfDayUnix() - nowHamsterUnix;
}

function formatToHoursAndMinutes(unixTime) {
  let hours = Math.floor(unixTime / 3600000);
  let minutes = Math.floor((unixTime % 3600000) / 60000);

  return `${hours}h ${minutes}m`;
}

function puzzleTimeLeftCountdown() {
  const timerDisplay = document.getElementById('puzzle-timer');
  timerDisplay.textContent = formatToHoursAndMinutes(puzzleTimeLeft());

  countdown = setInterval(
    function() {
      timerDisplay.textContent = formatToHoursAndMinutes(puzzleTimeLeft());
    },
    10 * 1000
  );
}


function getCurrentPuzzle() {
  if (puzzles[hamsterDate()]) {
    return puzzles[hamsterDate()];
  }

  return null
}

if (window.top === window.self) {
  $(function() {
      // if url has prev.html
      if (window.location.href.endsWith("prev.html")) {
        // Fill the div with id "prev" with table containing all the elements of the puzzles object
        let table = "<table>";
        table += "<tr><th>Date</th><th>Mini Game</th></tr>";
        for (let key in puzzles) {
          table += "<tr><td>" + key + "</td><td><a href='index.html#" + puzzles[key] + "'>link</a></td></tr>";
        }
        table += "</table>";
        $('#prev').html(table);

        return
      }
      let currentPuzzle = getCurrentPuzzle() || parseHash();
      if (currentPuzzle !== null && currentPuzzle !== "") {
        if (parseHash() === "" || parseHash() === null) {
          $('.main-button').hide();
        } else {
          $('#daily-time-left').hide();
        }

        let view = showBoard();
        view.setBoard(new Board(currentPuzzle), 60);
        puzzleTimeLeftCountdown();

        document.ontouchmove = function(event) {
            event.preventDefault();
        }

        window.onhashchange = function() {
            view.parseHash();
            if (parseHash() === "" || parseHash() === null) {
              $('.main-button').hide();
            }
        }

        $('#resetButton').click(function() {
            view.reset();
            clearInterval(countdown);
            startCountdown(60);
        });

        $('#undoButton').click(function() {
            view.undo();
        });

        view.parseHash();
        startCountdown(60);
      } else {
        $('.main-button').hide();
        $('#view').hide();
        $('.footer').hide();
        $('.timer').hide();
        $('#no-puzzle').show();
      }
  });
} else {
  $(function() {
    $('#view').html("Please visit <a href='https://fspv.github.io/hamster-kombat-puzzle-sim/'>https://fspv.github.io/hamster-kombat-puzzle-sim/</a> to play the game.");
    $('.main-button').hide();
    $('.footer').hide();
    $('.timer').hide();
    $('.previous-button').hide();
  })
}
