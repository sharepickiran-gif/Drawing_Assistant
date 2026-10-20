console.log("Drawing Assistant is running.");

const imageUpload = document.getElementById("imageUpload");
const downloadButton = document.getElementById("downloadImage");
const referenceImage = document.getElementById("referenceImage");
const placeholder = document.getElementById("placeholder");
const imageStatus = document.getElementById("imageStatus");

const paperWorkspace = document.getElementById("paperWorkspace");
const paperStage = document.getElementById("paperStage");
const paperSizeSelect = document.getElementById("paperSize");
const customPaperSettings = document.getElementById("customPaperSettings");
const customPaperWidthInput = document.getElementById("customPaperWidth");
const customPaperHeightInput = document.getElementById("customPaperHeight");
const customPaperStatus = document.getElementById("customPaperStatus");
const orientationSelect = document.getElementById("paperOrientation");
const gridModeSelect = document.getElementById("gridMode");
const regularGridSettings = document.getElementById("regularGridSettings");
const gridColorInput = document.getElementById("gridColor");
const gridOpacityInput = document.getElementById("gridOpacityInput");
const gridOpacityStatus = document.getElementById("gridOpacityStatus");
const gridThicknessInput = document.getElementById("gridThicknessInput");
const gridThicknessStatus = document.getElementById("gridThicknessStatus");
const gridSizeInput = document.getElementById("gridSizeInput");
const gridSizeStatus = document.getElementById("gridSizeStatus");
const halfGridButton = document.getElementById("halfGridButton");
const diagonalsButton = document.getElementById("diagonalsButton");
const randomGridLineButton = document.getElementById("randomGridLineButton");
const undoGridActionButton = document.getElementById("undoGridActionButton");
const drawingControls = document.getElementById("drawingControls");

const drawingCanvas = document.getElementById("drawingCanvas");
const drawingInstructions = document.getElementById("drawingInstructions");

const resetButton = document.getElementById("resetLine");
const undoButton = document.getElementById("undoAction");
const redButton = document.getElementById("addHorizontalLine");
const blueButton = document.getElementById("addVerticalLine");
const randomButton = document.getElementById("addRandomLine");

const ctx = drawingCanvas.getContext("2d");

const PAPER_SIZES = {
    A5: { width: 148, height: 210 },
    A4: { width: 210, height: 297 },
    A3: { width: 297, height: 420 }
};

const DEFAULT_GRID_SIZES_CM = {
    A5: 1,
    A4: 2,
    A3: 4
};

const PIXELS_PER_MM = 4;
const BASE_LINE_WIDTH = 4;
const EXTRA_LINE_WIDTH = 2;
const MIN_GRID_SIZE_CM = 0.1;
const MAX_GRID_SIZE_CM = 100;

let paperWidth = 210;
let paperHeight = 297;

let eyePoints = [];
let centreAnchor = null;
let randomStart = null;
let extraGuides = [];
let history = [];
let placementMode = null;
let currentImageURL = null;
let gridSizeCm = DEFAULT_GRID_SIZES_CM.A4;
let halfGridCells = new Set();
let diagonalGridCells = new Set();
let randomGridLines = [];
let gridActionHistory = [];
let choosingHalfGridCells = false;
let choosingDiagonalCells = false;
let choosingRandomGridLine = false;
let pendingRandomGridPoint = null;

function getPaperDimensions() {
    const size = PAPER_SIZES[paperSizeSelect.value];
    let width = size
        ? size.width
        : customPaperWidthInput.valueAsNumber * 10;
    let height = size
        ? size.height
        : customPaperHeightInput.valueAsNumber * 10;

    if (orientationSelect.value === "landscape") {
        [width, height] = [height, width];
    }

    return { width, height };
}

function configurePaper(resetGuides = true) {
    customPaperSettings.hidden = paperSizeSelect.value !== "custom";
    if (paperSizeSelect.value === "custom" && (
        !customPaperWidthInput.validity.valid ||
        !customPaperHeightInput.validity.valid
    )) {
        customPaperStatus.textContent =
            "Enter paper dimensions from 1 to 100 cm.";
        customPaperWidthInput.setAttribute(
            "aria-invalid",
            String(!customPaperWidthInput.validity.valid)
        );
        customPaperHeightInput.setAttribute(
            "aria-invalid",
            String(!customPaperHeightInput.validity.valid)
        );
        return;
    }

    customPaperStatus.textContent = "";
    customPaperWidthInput.removeAttribute("aria-invalid");
    customPaperHeightInput.removeAttribute("aria-invalid");
    const dimensions = getPaperDimensions();

    paperWidth = dimensions.width;
    paperHeight = dimensions.height;

    drawingCanvas.width = paperWidth * PIXELS_PER_MM;
    drawingCanvas.height = paperHeight * PIXELS_PER_MM;

    paperStage.style.aspectRatio =
        `${paperWidth} / ${paperHeight}`;
    positionReferenceImage();

    renderRulers();

    if (resetGuides) {
        eyePoints = [];
        centreAnchor = null;
        randomStart = null;
        extraGuides = [];
        history = [];
        placementMode = null;
        gridSizeCm = DEFAULT_GRID_SIZES_CM[paperSizeSelect.value] || 2;
        gridSizeInput.value = String(gridSizeCm);
        gridSizeInput.removeAttribute("aria-invalid");
        halfGridCells.clear();
        diagonalGridCells.clear();
        randomGridLines = [];
        gridActionHistory = [];
        choosingHalfGridCells = false;
        choosingDiagonalCells = false;
        choosingRandomGridLine = false;
        pendingRandomGridPoint = null;
        halfGridButton.setAttribute("aria-pressed", "false");
        diagonalsButton.setAttribute("aria-pressed", "false");
        randomGridLineButton.setAttribute("aria-pressed", "false");

        drawingInstructions.textContent =
            "Place your guides again for the selected paper size.";
    }

    updateGridSizeStatus();
    updateControls();
    redrawCanvas();
}

function renderRulers() {
    renderOneRuler(
        document.getElementById("topRuler"),
        paperWidth,
        "horizontal"
    );

    renderOneRuler(
        document.getElementById("bottomRuler"),
        paperWidth,
        "horizontal"
    );

    renderOneRuler(
        document.getElementById("leftRuler"),
        paperHeight,
        "vertical"
    );

    renderOneRuler(
        document.getElementById("rightRuler"),
        paperHeight,
        "vertical"
    );
}

function renderOneRuler(container, length, direction) {
    container.replaceChildren();

    for (let mm = 0; mm <= length; mm++) {
        const position = (mm / length) * 100;
        const tick = document.createElement("div");
        const isCentimeter = mm % 10 === 0;

        tick.className = "ruler-tick";
        if (isCentimeter) {
            tick.classList.add("major");
        } else if (mm % 5 === 0) {
            tick.classList.add("half");
        }

        if (direction === "horizontal") {
            tick.style.left = `${position}%`;
        } else {
            tick.style.top = `${position}%`;
        }

        container.appendChild(tick);

        if (isCentimeter) {
            const label = document.createElement("span");

            label.className = "ruler-label";
            label.textContent = mm / 10;
            if ((mm / 10) % 2 !== 0) {
                label.classList.add("alternate");
            }

            if (direction === "horizontal") {
                label.style.left = `${position}%`;
            } else {
                label.style.top = `${position}%`;
            }

            container.appendChild(label);
        }
    }
}

function getImageBounds() {
    if (!referenceImage.naturalWidth) return null;

    const scale = Math.min(
        drawingCanvas.width / referenceImage.naturalWidth,
        drawingCanvas.height / referenceImage.naturalHeight
    );

    const width = referenceImage.naturalWidth * scale;
    const height = referenceImage.naturalHeight * scale;

    return {
        x: (drawingCanvas.width - width) / 2,
        y: (drawingCanvas.height - height) / 2,
        width,
        height
    };
}

function positionReferenceImage() {
    const bounds = getImageBounds();

    if (!bounds) return;

    referenceImage.style.position = "absolute";
    referenceImage.style.width =
        (bounds.width / drawingCanvas.width * 100) + "%";
    referenceImage.style.height =
        (bounds.height / drawingCanvas.height * 100) + "%";
    referenceImage.style.left =
        (bounds.x / drawingCanvas.width * 100) + "%";
    referenceImage.style.top =
        (bounds.y / drawingCanvas.height * 100) + "%";
}

function pointInsideImage(point) {
    const bounds = getImageBounds();
    if (!bounds) return false;

    return (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height
    );
}

function getGridCellSize() {
    return gridSizeCm * 10 * PIXELS_PER_MM;
}

function isRegularGridMode() {
    return gridModeSelect.value === "regular";
}

function updateGridSizeStatus() {
    gridSizeStatus.textContent = `${gridSizeCm} cm squares`;
}

function showCurrentModeInstructions() {
    if (paperWorkspace.hidden) return;

    if (gridModeSelect.value === "regular") {
        if (choosingHalfGridCells) {
            drawingInstructions.textContent =
                "Click any grid square to divide it into four equal squares. Click Half grids again when finished.";
        } else if (choosingDiagonalCells) {
            drawingInstructions.textContent =
                "Click any grid square to add both diagonals. Click Diagonals again when finished.";
        } else if (choosingRandomGridLine) {
            drawingInstructions.textContent = pendingRandomGridPoint
                ? "Click another grid intersection to complete the line."
                : "Click two grid intersections to draw a line between them.";
        } else {
            drawingInstructions.textContent =
                "Regular grid is active. Choose a color or enter a square size in centimeters.";
        }
        return;
    }

    if (eyePoints.length < 2) {
        drawingInstructions.textContent =
            "Step 1: Click the centre of the first eye.";
    } else if (!centreAnchor) {
        drawingInstructions.textContent =
            "Step 3: Click the facial centreline intersection with the eye line.";
    } else {
        drawingInstructions.textContent =
            "Select Red line, Blue line, or Random line to add guides.";
    }
}

function drawRegularGrid() {
    const cellSize = getGridCellSize();
    if (!cellSize) return;

    ctx.save();
    ctx.strokeStyle = gridColorInput.value;
    ctx.globalAlpha = gridOpacityInput.valueAsNumber / 100;
    ctx.lineWidth = gridThicknessInput.valueAsNumber;
    ctx.beginPath();

    for (let x = 0; x <= drawingCanvas.width; x += cellSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, drawingCanvas.height);
    }

    for (let y = 0; y <= drawingCanvas.height; y += cellSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(drawingCanvas.width, y);
    }

    ctx.stroke();

    halfGridCells.forEach(function (cell) {
        const [column, row] = cell.split(":").map(Number);
        const left = column * cellSize;
        const top = row * cellSize;
        const right = Math.min(left + cellSize, drawingCanvas.width);
        const bottom = Math.min(top + cellSize, drawingCanvas.height);

        ctx.beginPath();
        ctx.moveTo((left + right) / 2, top);
        ctx.lineTo((left + right) / 2, bottom);
        ctx.moveTo(left, (top + bottom) / 2);
        ctx.lineTo(right, (top + bottom) / 2);
        ctx.stroke();
    });

    diagonalGridCells.forEach(function (cell) {
        const [column, row] = cell.split(":").map(Number);
        const left = column * cellSize;
        const top = row * cellSize;
        const right = Math.min(left + cellSize, drawingCanvas.width);
        const bottom = Math.min(top + cellSize, drawingCanvas.height);

        ctx.beginPath();
        ctx.moveTo(left, top);
        ctx.lineTo(right, bottom);
        ctx.moveTo(right, top);
        ctx.lineTo(left, bottom);
        ctx.stroke();
    });

    randomGridLines.forEach(function (line) {
        const start = getGridIntersectionPoint(line.start, cellSize);
        const end = getGridIntersectionPoint(line.end, cellSize);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
    });

    if (pendingRandomGridPoint) {
        const point = getGridIntersectionPoint(pendingRandomGridPoint, cellSize);
        ctx.fillStyle = gridColorInput.value;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

function getGridIntersectionPoint(intersection, cellSize) {
    return {
        x: Math.min(intersection.column * cellSize, drawingCanvas.width),
        y: Math.min(intersection.row * cellSize, drawingCanvas.height)
    };
}

gridModeSelect.addEventListener("change", function () {
    placementMode = null;
    choosingHalfGridCells = false;
    choosingDiagonalCells = false;
    choosingRandomGridLine = false;
    pendingRandomGridPoint = null;
    halfGridButton.setAttribute("aria-pressed", "false");
    diagonalsButton.setAttribute("aria-pressed", "false");
    randomGridLineButton.setAttribute("aria-pressed", "false");
    updateControls();
    redrawCanvas();
    showCurrentModeInstructions();
});

gridColorInput.addEventListener("input", redrawCanvas);

gridOpacityInput.addEventListener("input", function () {
    gridOpacityStatus.value = `${100 - gridOpacityInput.valueAsNumber}%`;
    redrawCanvas();
});

gridThicknessInput.addEventListener("input", function () {
    gridThicknessStatus.value = `${gridThicknessInput.valueAsNumber} px`;
    redrawCanvas();
});

halfGridButton.addEventListener("click", function () {
    if (paperWorkspace.hidden || gridModeSelect.value !== "regular") return;

    choosingHalfGridCells = !choosingHalfGridCells;
    choosingDiagonalCells = false;
    choosingRandomGridLine = false;
    pendingRandomGridPoint = null;
    halfGridButton.setAttribute("aria-pressed", String(choosingHalfGridCells));
    diagonalsButton.setAttribute("aria-pressed", "false");
    randomGridLineButton.setAttribute("aria-pressed", "false");
    updateControls();
    redrawCanvas();
    showCurrentModeInstructions();
});

diagonalsButton.addEventListener("click", function () {
    if (paperWorkspace.hidden || gridModeSelect.value !== "regular") return;

    choosingDiagonalCells = !choosingDiagonalCells;
    choosingHalfGridCells = false;
    choosingRandomGridLine = false;
    pendingRandomGridPoint = null;
    diagonalsButton.setAttribute("aria-pressed", String(choosingDiagonalCells));
    halfGridButton.setAttribute("aria-pressed", "false");
    randomGridLineButton.setAttribute("aria-pressed", "false");
    updateControls();
    redrawCanvas();
    showCurrentModeInstructions();
});

randomGridLineButton.addEventListener("click", function () {
    if (paperWorkspace.hidden || gridModeSelect.value !== "regular") return;

    choosingRandomGridLine = !choosingRandomGridLine;
    choosingHalfGridCells = false;
    choosingDiagonalCells = false;
    pendingRandomGridPoint = null;
    randomGridLineButton.setAttribute(
        "aria-pressed",
        String(choosingRandomGridLine)
    );
    halfGridButton.setAttribute("aria-pressed", "false");
    diagonalsButton.setAttribute("aria-pressed", "false");
    updateControls();
    redrawCanvas();
    showCurrentModeInstructions();
});

undoGridActionButton.addEventListener("click", function () {
    if (pendingRandomGridPoint) {
        pendingRandomGridPoint = null;
        updateControls();
        redrawCanvas();
        showCurrentModeInstructions();
        return;
    }

    const previousAction = gridActionHistory.pop();
    if (!previousAction) return;

    if (previousAction.type === "half-grid") {
        halfGridCells.delete(previousAction.cell);
    } else if (previousAction.type === "diagonal") {
        diagonalGridCells.delete(previousAction.cell);
    } else {
        randomGridLines.splice(randomGridLines.indexOf(previousAction.line), 1);
    }
    updateControls();
    redrawCanvas();
});

gridSizeInput.addEventListener("input", function () {
    const value = gridSizeInput.valueAsNumber;
    const isValid = Number.isFinite(value) &&
        value >= MIN_GRID_SIZE_CM &&
        value <= MAX_GRID_SIZE_CM;

    gridSizeInput.setAttribute("aria-invalid", String(!isValid));
    if (!isValid) {
        gridSizeStatus.textContent =
            `Enter a size from ${MIN_GRID_SIZE_CM} to ${MAX_GRID_SIZE_CM} cm.`;
        return;
    }

    gridSizeCm = value;
    updateControls();
    updateGridSizeStatus();
    redrawCanvas();
});

imageUpload.addEventListener("change", function () {
    const file = imageUpload.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        imageStatus.textContent = "Please select an image file.";
        return;
    }

    if (currentImageURL) {
        URL.revokeObjectURL(currentImageURL);
    }

    currentImageURL = URL.createObjectURL(file);
    downloadButton.disabled = true;

    referenceImage.onload = function () {
        placeholder.hidden = true;
        paperWorkspace.hidden = false;
        drawingInstructions.hidden = false;

        imageStatus.textContent =
            referenceImage.naturalWidth + " × " +
            referenceImage.naturalHeight + " pixels";

        configurePaper(true);
        downloadButton.disabled = false;

        showCurrentModeInstructions();
    };

    referenceImage.onerror = function () {
        imageStatus.textContent = "Unable to display this image.";
        downloadButton.disabled = true;
        URL.revokeObjectURL(currentImageURL);
        currentImageURL = null;
    };

    referenceImage.src = currentImageURL;
});

function drawExportRuler(exportContext, x, y, length, direction, thickness) {
    const rulerLength = direction === "horizontal" ? paperWidth : paperHeight;

    exportContext.save();
    exportContext.beginPath();
    exportContext.rect(
        x,
        y,
        direction === "horizontal" ? length : thickness,
        direction === "horizontal" ? thickness : length
    );
    exportContext.clip();

    exportContext.fillStyle = "#f0eee8";
    exportContext.fillRect(
        x,
        y,
        direction === "horizontal" ? length : thickness,
        direction === "horizontal" ? thickness : length
    );

    exportContext.strokeStyle = "#777";
    exportContext.fillStyle = "#555";
    exportContext.lineWidth = 1;
    exportContext.font = "9px Arial, sans-serif";

    for (let mm = 0; mm <= rulerLength; mm++) {
        const position = (mm / rulerLength) * length;
        const major = mm % 10 === 0;
        const tickLength = major ? 12 : mm % 5 === 0 ? 8 : 4;

        exportContext.beginPath();
        if (direction === "horizontal") {
            exportContext.moveTo(x + position, y);
            exportContext.lineTo(x + position, y + tickLength);
        } else {
            exportContext.moveTo(x, y + position);
            exportContext.lineTo(x + tickLength, y + position);
        }
        exportContext.stroke();

        if (major) {
            exportContext.textAlign =
                direction === "horizontal" ? "center" : "left";
            exportContext.textBaseline =
                direction === "horizontal" ? "alphabetic" : "middle";
            exportContext.fillText(
                String(mm / 10),
                direction === "horizontal" ? x + position : x + 14,
                direction === "horizontal" ? y + 22 : y + position
            );
        }
    }

    exportContext.restore();
}

function createExportCanvas() {
    const rulerSize = 38;
    const exportCanvas = document.createElement("canvas");
    const exportContext = exportCanvas.getContext("2d");

    if (!exportContext) {
        throw new Error("Unable to create the image export canvas.");
    }

    exportCanvas.width = drawingCanvas.width + rulerSize * 2;
    exportCanvas.height = drawingCanvas.height + rulerSize * 2;

    exportContext.fillStyle = "#fff";
    exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    drawExportRuler(exportContext, rulerSize, 0, drawingCanvas.width, "horizontal", rulerSize);
    drawExportRuler(
        exportContext,
        rulerSize,
        drawingCanvas.height + rulerSize,
        drawingCanvas.width,
        "horizontal",
        rulerSize
    );
    drawExportRuler(exportContext, 0, rulerSize, drawingCanvas.height, "vertical", rulerSize);
    drawExportRuler(
        exportContext,
        drawingCanvas.width + rulerSize,
        rulerSize,
        drawingCanvas.height,
        "vertical",
        rulerSize
    );

    const bounds = getImageBounds();
    if (bounds) {
        exportContext.drawImage(
            referenceImage,
            rulerSize + bounds.x,
            rulerSize + bounds.y,
            bounds.width,
            bounds.height
        );
    }
    exportContext.drawImage(drawingCanvas, rulerSize, rulerSize);
    exportContext.strokeStyle = "#bdbdbd";
    exportContext.lineWidth = 1;
    exportContext.strokeRect(
        rulerSize + 0.5,
        rulerSize + 0.5,
        drawingCanvas.width - 1,
        drawingCanvas.height - 1
    );

    return exportCanvas;
}

downloadButton.addEventListener("click", function () {
    if (downloadButton.disabled || paperWorkspace.hidden) return;

    try {
        createExportCanvas().toBlob(function (blob) {
            if (!blob) {
                imageStatus.textContent = "Unable to create the image download.";
                return;
            }

            const downloadURL = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = downloadURL;
            link.download = "drawing-assistant-reference.png";
            link.click();
            setTimeout(function () {
                URL.revokeObjectURL(downloadURL);
            }, 1000);
        }, "image/png");
    } catch (error) {
        console.error("Image export failed:", error);
        imageStatus.textContent = "Unable to create the image download.";
    }
});

paperSizeSelect.addEventListener("change", function () {
    if (!paperWorkspace.hidden) configurePaper(true);
    else customPaperSettings.hidden = paperSizeSelect.value !== "custom";
});

function updateCustomPaperSize() {
    if (!paperWorkspace.hidden && paperSizeSelect.value === "custom") {
        configurePaper(true);
    }
}

customPaperWidthInput.addEventListener("change", updateCustomPaperSize);
customPaperHeightInput.addEventListener("change", updateCustomPaperSize);

customPaperWidthInput.addEventListener("input", function () {
    customPaperWidthInput.setAttribute(
        "aria-invalid",
        String(!customPaperWidthInput.validity.valid)
    );
});

customPaperHeightInput.addEventListener("input", function () {
    customPaperHeightInput.setAttribute(
        "aria-invalid",
        String(!customPaperHeightInput.validity.valid)
    );
});

orientationSelect.addEventListener("change", function () {
    if (!paperWorkspace.hidden) configurePaper(true);
});

function saveHistory() {
    history.push({
        eyePoints: eyePoints.map(p => ({ ...p })),
        centreAnchor: centreAnchor ? { ...centreAnchor } : null,
        randomStart: randomStart ? { ...randomStart } : null,
        extraGuides: extraGuides.map(g => ({ ...g }))
    });

    updateControls();
}

function undoOneAction() {
    if (randomStart) {
        randomStart = null;
        updateControls();
        redrawCanvas();
        drawingInstructions.textContent =
            "Pending green line cancelled.";
        return;
    }

    if (!history.length) {
        drawingInstructions.textContent = "Nothing more to undo.";
        return;
    }

    const previous = history.pop();

    eyePoints = previous.eyePoints;
    centreAnchor = previous.centreAnchor;
    randomStart = previous.randomStart;
    extraGuides = previous.extraGuides;

    updateControls();
    redrawCanvas();
    drawingInstructions.textContent = "Previous action undone.";
}

function updateControls() {
    const hasImage = !paperWorkspace.hidden;
    const isCustomMode = gridModeSelect.value === "custom";
    const baseReady = eyePoints.length === 2 && centreAnchor !== null;

    drawingControls.hidden = !hasImage || !isCustomMode;
    regularGridSettings.hidden = gridModeSelect.value !== "regular";
    halfGridButton.disabled = !hasImage || !isRegularGridMode();
    halfGridButton.setAttribute("aria-pressed", String(choosingHalfGridCells));
    diagonalsButton.disabled = !hasImage || !isRegularGridMode();
    diagonalsButton.setAttribute("aria-pressed", String(choosingDiagonalCells));
    randomGridLineButton.disabled = !hasImage || !isRegularGridMode();
    randomGridLineButton.setAttribute(
        "aria-pressed",
        String(choosingRandomGridLine)
    );
    undoGridActionButton.disabled =
        !hasImage || !isRegularGridMode() ||
        (gridActionHistory.length === 0 && !pendingRandomGridPoint);
    downloadButton.disabled = !hasImage;

    undoButton.disabled = !hasImage || !isCustomMode;
    resetButton.disabled = !hasImage || !isCustomMode;
    redButton.disabled = !baseReady || !isCustomMode;
    blueButton.disabled = !baseReady || !isCustomMode;
    randomButton.disabled = !baseReady || !isCustomMode;

    redButton.style.background =
        placementMode === "red" ? "#fde8e8" : "white";

    blueButton.style.background =
        placementMode === "blue" ? "#e6f2ff" : "white";

    randomButton.style.background =
        placementMode === "random" ? "#e8f5e9" : "white";

    undoButton.style.background =
        placementMode === "undo" ? "#eeeeee" : "white";
}

function projectPointOntoLine(point, first, second) {
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared < 0.000001) return { ...first };

    const t = (
        (point.x - first.x) * dx +
        (point.y - first.y) * dy
    ) / lengthSquared;

    return {
        x: first.x + t * dx,
        y: first.y + t * dy
    };
}

drawingCanvas.addEventListener("click", function (event) {
    if (paperWorkspace.hidden) return;

    const rect = drawingCanvas.getBoundingClientRect();

    const point = {
        x: (event.clientX - rect.left) *
            drawingCanvas.width / rect.width,
        y: (event.clientY - rect.top) *
            drawingCanvas.height / rect.height
    };

    if (isRegularGridMode()) {
        if (
            !choosingHalfGridCells &&
            !choosingDiagonalCells &&
            !choosingRandomGridLine
        ) return;

        const cellSize = getGridCellSize();
        if (choosingRandomGridLine) {
            const maxColumn = Math.ceil(drawingCanvas.width / cellSize);
            const maxRow = Math.ceil(drawingCanvas.height / cellSize);
            const intersection = {
                column: Math.max(
                    0,
                    Math.min(Math.round(point.x / cellSize), maxColumn)
                ),
                row: Math.max(
                    0,
                    Math.min(Math.round(point.y / cellSize), maxRow)
                )
            };

            if (!pendingRandomGridPoint) {
                pendingRandomGridPoint = intersection;
            } else if (
                pendingRandomGridPoint.column !== intersection.column ||
                pendingRandomGridPoint.row !== intersection.row
            ) {
                const line = {
                    start: pendingRandomGridPoint,
                    end: intersection
                };
                randomGridLines.push(line);
                gridActionHistory.push({ type: "random-line", line });
                pendingRandomGridPoint = null;
            }
            updateControls();
            redrawCanvas();
            showCurrentModeInstructions();
            return;
        }

        const column = Math.min(
            Math.floor(point.x / cellSize),
            Math.ceil(drawingCanvas.width / cellSize) - 1
        );
        const row = Math.min(
            Math.floor(point.y / cellSize),
            Math.ceil(drawingCanvas.height / cellSize) - 1
        );

        const cell = `${column}:${row}`;
        if (choosingHalfGridCells) {
            if (!halfGridCells.has(cell)) {
                halfGridCells.add(cell);
                gridActionHistory.push({ type: "half-grid", cell });
            }
        } else {
            if (!diagonalGridCells.has(cell)) {
                diagonalGridCells.add(cell);
                gridActionHistory.push({ type: "diagonal", cell });
            }
        }
        updateControls();
        redrawCanvas();
        return;
    }

    if (gridModeSelect.value !== "custom") return;

    if (placementMode === "undo") {
        undoOneAction();
        return;
    }

    // Eye points must be selected on the photograph.
    if (eyePoints.length < 2) {
        if (!pointInsideImage(point)) {
            drawingInstructions.textContent =
                "Please select eye points on the photograph.";
            return;
        }

        saveHistory();
        eyePoints.push(point);

        drawingInstructions.textContent = eyePoints.length === 1
            ? "Step 2: Click the centre of the other eye."
            : "Step 3: Click the facial centreline intersection with the eye line.";

        updateControls();
        redrawCanvas();
        return;
    }

    if (!centreAnchor) {
        if (!pointInsideImage(point)) {
            drawingInstructions.textContent =
                "Please select the intersection on the photograph.";
            return;
        }

        saveHistory();

        centreAnchor = projectPointOntoLine(
            point,
            eyePoints[0],
            eyePoints[1]
        );

        placementMode = null;

        drawingInstructions.textContent =
            "Select Red line, Blue line, or Random line to add guides.";

        updateControls();
        redrawCanvas();
        return;
    }

    if (placementMode === "random") {
        if (!randomStart) {
            randomStart = point;
            drawingInstructions.textContent =
                "Random line: select the second point.";
        } else {
            const start = randomStart;
            randomStart = null;
            saveHistory();
            extraGuides.push({
                type: "random-line",
                anchor: start,
                direction: {
                    x: point.x - start.x,
                    y: point.y - start.y
                },
                color: "#2e9d50"
            });
            drawingInstructions.textContent =
                "Green line added. Select two points to draw another.";
        }

        updateControls();
        redrawCanvas();
        return;
    }

    // Additional guides can be placed anywhere on the paper.
    if (placementMode === "red" || placementMode === "blue") {
        saveHistory();

        extraGuides.push({
            type: placementMode === "red"
                ? "parallel-eye"
                : "parallel-centre",
            color: placementMode === "red"
                ? "#e53935"
                : "#1687ff",
            anchor: point
        });

        drawingInstructions.textContent =
            "Guide added. Continue clicking to add more, or select another mode.";

        updateControls();
        redrawCanvas();
    }
});

redButton.addEventListener("click", function () {
    if (!centreAnchor) return;

    placementMode = "red";
    drawingInstructions.textContent =
        "Red mode: click anywhere on the paper to add a line parallel to the eye line.";

    updateControls();
});

blueButton.addEventListener("click", function () {
    if (!centreAnchor) return;

    placementMode = "blue";
    drawingInstructions.textContent =
        "Blue mode: click anywhere on the paper to add a line parallel to the centreline.";

    updateControls();
});

randomButton.addEventListener("click", function () {
    if (!centreAnchor) return;

    randomStart = null;
    placementMode = "random";
    drawingInstructions.textContent =
        "Random line: select two points on the paper.";

    updateControls();
});

undoButton.addEventListener("click", function () {
    placementMode = "undo";

    drawingInstructions.textContent =
        "Undo mode: click the paper to undo one action. Click repeatedly to undo more.";

    updateControls();
});

resetButton.addEventListener("click", function () {
    saveHistory();

    eyePoints = [];
    centreAnchor = null;
    randomStart = null;
    extraGuides = [];
    placementMode = null;

    updateControls();
    redrawCanvas();

    drawingInstructions.textContent =
        "Guides reset. Click the centre of the first eye to begin again.";
});

function drawIntersectionLabel(point) {
    const w = drawingCanvas.width;
    const h = drawingCanvas.height;
    const inset = 5 * PIXELS_PER_MM;
    const padding = PIXELS_PER_MM;
    const fontSize = 5 * PIXELS_PER_MM;
    const isVerticalEdge = point.x <= 0.01 || point.x >= w - 0.01;
    const coordinate = isVerticalEdge ? point.y : point.x;
    const label = `${(coordinate / (PIXELS_PER_MM * 10)).toFixed(1)} cm`;

    let x;
    let y;
    let textAlign;
    let textBaseline;

    if (isVerticalEdge) {
        const isLeftEdge = point.x <= 0.01;
        x = isLeftEdge ? inset : w - inset;
        y = Math.max(inset, Math.min(h - inset, point.y));
        textAlign = isLeftEdge ? "left" : "right";
        textBaseline = "middle";
    } else {
        x = Math.max(inset, Math.min(w - inset, point.x));
        y = point.y <= 0.01 ? inset : h - inset;
        textAlign = point.x <= w / 2 ? "left" : "right";
        textBaseline = point.y <= 0.01 ? "top" : "bottom";
    }

    ctx.save();
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = textAlign;
    ctx.textBaseline = textBaseline;

    const textWidth = ctx.measureText(label).width;
    const boxX = textAlign === "left"
        ? x - padding
        : x - textWidth - padding;
    const boxY = textBaseline === "top"
        ? y - padding
        : textBaseline === "bottom"
            ? y - fontSize - padding
            : y - fontSize / 2 - padding;

    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.fillRect(
        boxX,
        boxY,
        textWidth + padding * 2,
        fontSize + padding * 2
    );
    ctx.fillStyle = "#222";
    ctx.fillText(label, x, y);
    ctx.restore();
}

function drawInfiniteLine(point, direction, color, width) {
    const w = drawingCanvas.width;
    const h = drawingCanvas.height;
    const epsilon = 0.000001;
    const intersections = [];

    function add(x, y) {
        if (
            x >= -epsilon && x <= w + epsilon &&
            y >= -epsilon && y <= h + epsilon
        ) {
            if (!intersections.some(
                p => Math.hypot(p.x - x, p.y - y) < 0.01
            )) {
                intersections.push({
                    x: Math.max(0, Math.min(w, x)),
                    y: Math.max(0, Math.min(h, y))
                });
            }
        }
    }

    if (Math.abs(direction.x) > epsilon) {
        let t = -point.x / direction.x;
        add(0, point.y + t * direction.y);

        t = (w - point.x) / direction.x;
        add(w, point.y + t * direction.y);
    }

    if (Math.abs(direction.y) > epsilon) {
        let t = -point.y / direction.y;
        add(point.x + t * direction.x, 0);

        t = (h - point.y) / direction.y;
        add(point.x + t * direction.x, h);
    }

    if (intersections.length < 2) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(intersections[0].x, intersections[0].y);
    ctx.lineTo(intersections[1].x, intersections[1].y);
    ctx.stroke();

    intersections.forEach(drawIntersectionLabel);
}

function drawPoint(point, color, radius) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
}

function redrawCanvas() {
    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);

    if (gridModeSelect.value === "regular") {
        drawRegularGrid();
        return;
    }

    const baseWidth = BASE_LINE_WIDTH * PIXELS_PER_MM / 4;
    const extraWidth = EXTRA_LINE_WIDTH * PIXELS_PER_MM / 4;
    const radius = 5;

    if (eyePoints.length === 2) {
        const a = eyePoints[0];
        const b = eyePoints[1];

        drawInfiniteLine(
            a,
            { x: b.x - a.x, y: b.y - a.y },
            "#e53935",
            baseWidth
        );
    }

    if (eyePoints.length === 2 && centreAnchor) {
        const a = eyePoints[0];
        const b = eyePoints[1];

        drawInfiniteLine(
            centreAnchor,
            { x: -(b.y - a.y), y: b.x - a.x },
            "#1687ff",
            baseWidth
        );
    }

    extraGuides.forEach(function (guide) {
        const a = eyePoints[0];
        const b = eyePoints[1];

        if (guide.type === "random-line") {
            drawInfiniteLine(
                guide.anchor,
                guide.direction,
                guide.color,
                extraWidth
            );
            return;
        }

        if (guide.type === "parallel-eye") {
            drawInfiniteLine(
                guide.anchor,
                { x: b.x - a.x, y: b.y - a.y },
                guide.color,
                extraWidth
            );
        }

        if (guide.type === "parallel-centre") {
            drawInfiniteLine(
                guide.anchor,
                { x: -(b.y - a.y), y: b.x - a.x },
                guide.color,
                extraWidth
            );
        }
    });

    eyePoints.forEach(p => drawPoint(p, "#e53935", radius));

    if (centreAnchor) {
        drawPoint(centreAnchor, "#1687ff", radius * 1.4);
    }
}