console.log("Drawing Assistant is running.");

const imageUpload = document.getElementById("imageUpload");
const referenceImage = document.getElementById("referenceImage");
const placeholder = document.getElementById("placeholder");
const imageStatus = document.getElementById("imageStatus");

const paperWorkspace = document.getElementById("paperWorkspace");
const paperStage = document.getElementById("paperStage");
const paperSizeSelect = document.getElementById("paperSize");
const orientationSelect = document.getElementById("paperOrientation");

const drawingCanvas = document.getElementById("drawingCanvas");
const drawingInstructions = document.getElementById("drawingInstructions");

const resetButton = document.getElementById("resetLine");
const undoButton = document.getElementById("undoAction");
const redButton = document.getElementById("addHorizontalLine");
const blueButton = document.getElementById("addVerticalLine");

const ctx = drawingCanvas.getContext("2d");

const PAPER_SIZES = {
    A5: { width: 148, height: 210 },
    A4: { width: 210, height: 297 },
    A3: { width: 297, height: 420 }
};

const PIXELS_PER_MM = 4;
const BASE_LINE_WIDTH = 4;
const EXTRA_LINE_WIDTH = 1.8;

let paperWidth = 210;
let paperHeight = 297;

let eyePoints = [];
let centreAnchor = null;
let extraGuides = [];
let history = [];
let placementMode = null;
let currentImageURL = null;

function getPaperDimensions() {
    const size = PAPER_SIZES[paperSizeSelect.value];
    let width = size.width;
    let height = size.height;

    if (orientationSelect.value === "landscape") {
        [width, height] = [height, width];
    }

    return { width, height };
}

function configurePaper(resetGuides = true) {
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
        extraGuides = [];
        history = [];
        placementMode = null;

        drawingInstructions.textContent =
            "Place your guides again for the selected paper size.";
    }

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

    referenceImage.onload = function () {
        placeholder.hidden = true;
        paperWorkspace.hidden = false;
        drawingInstructions.hidden = false;

        imageStatus.textContent =
            referenceImage.naturalWidth + " × " +
            referenceImage.naturalHeight + " pixels";

        configurePaper(true);

        drawingInstructions.textContent =
            "Step 1: Click the centre of the first eye.";
    };

    referenceImage.onerror = function () {
        imageStatus.textContent = "Unable to display this image.";
        URL.revokeObjectURL(currentImageURL);
        currentImageURL = null;
    };

    referenceImage.src = currentImageURL;
});

paperSizeSelect.addEventListener("change", function () {
    if (!paperWorkspace.hidden) configurePaper(true);
});

orientationSelect.addEventListener("change", function () {
    if (!paperWorkspace.hidden) configurePaper(true);
});

function saveHistory() {
    history.push({
        eyePoints: eyePoints.map(p => ({ ...p })),
        centreAnchor: centreAnchor ? { ...centreAnchor } : null,
        extraGuides: extraGuides.map(g => ({ ...g }))
    });

    updateControls();
}

function undoOneAction() {
    if (!history.length) {
        drawingInstructions.textContent = "Nothing more to undo.";
        return;
    }

    const previous = history.pop();

    eyePoints = previous.eyePoints;
    centreAnchor = previous.centreAnchor;
    extraGuides = previous.extraGuides;

    updateControls();
    redrawCanvas();
    drawingInstructions.textContent = "Previous action undone.";
}

function updateControls() {
    const hasImage = !paperWorkspace.hidden;
    const baseReady = eyePoints.length === 2 && centreAnchor !== null;

    undoButton.disabled = !hasImage;
    resetButton.disabled = !hasImage;
    redButton.disabled = !baseReady;
    blueButton.disabled = !baseReady;

    redButton.style.background =
        placementMode === "red" ? "#fde8e8" : "white";

    blueButton.style.background =
        placementMode === "blue" ? "#e6f2ff" : "white";

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
            "Select Red line or Blue line, then click anywhere on the paper.";

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