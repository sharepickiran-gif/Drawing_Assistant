console.log("Loomis Drawing Assistant is running.");

const imageUpload = document.getElementById("imageUpload");
const referenceImage = document.getElementById("referenceImage");
const placeholder = document.getElementById("placeholder");
const imageStatus = document.getElementById("imageStatus");

const drawingArea = document.getElementById("drawingArea");
const drawingCanvas = document.getElementById("drawingCanvas");
const drawingInstructions = document.getElementById("drawingInstructions");
const resetLineButton = document.getElementById("resetLine");

const ctx = drawingCanvas.getContext("2d");

let eyePoints = [];
let currentImageURL = null;

imageUpload.addEventListener("change", function () {
    const file = imageUpload.files[0];

    if (!file) {
        return;
    }

    if (!file.type.startsWith("image/")) {
        imageStatus.textContent = "Please select an image file.";
        return;
    }

    if (currentImageURL) {
        URL.revokeObjectURL(currentImageURL);
        currentImageURL = null;
    }

    currentImageURL = URL.createObjectURL(file);

    referenceImage.onload = function () {
        placeholder.hidden = true;
        drawingArea.hidden = false;
        drawingInstructions.hidden = false;

        eyePoints = [];

        const maxDimension = 1800;
        const scale = Math.min(
            1,
            maxDimension / Math.max(
                referenceImage.naturalWidth,
                referenceImage.naturalHeight
            )
        );

        drawingCanvas.width = Math.round(
            referenceImage.naturalWidth * scale
        );

        drawingCanvas.height = Math.round(
            referenceImage.naturalHeight * scale
        );

        imageStatus.textContent =
            referenceImage.naturalWidth +
            " × " +
            referenceImage.naturalHeight +
            " pixels";

        drawingInstructions.textContent =
            "Click the centre of the first eye, then the second eye.";

        resetLineButton.disabled = false;

        redrawCanvas();
    };

    referenceImage.onerror = function () {
        imageStatus.textContent = "Unable to display this image.";

        URL.revokeObjectURL(currentImageURL);
        currentImageURL = null;
    };

    referenceImage.src = currentImageURL;
});

drawingCanvas.addEventListener("click", function (event) {
    if (drawingArea.hidden) {
        return;
    }

    const rect = drawingCanvas.getBoundingClientRect();

    const x = (event.clientX - rect.left) *
        drawingCanvas.width / rect.width;

    const y = (event.clientY - rect.top) *
        drawingCanvas.height / rect.height;

    if (eyePoints.length === 2) {
        eyePoints = [];
    }

    eyePoints.push({ x, y });

    redrawCanvas();

    if (eyePoints.length === 1) {
        drawingInstructions.textContent =
            "Now click the centre of the other eye.";
    } else {
        drawingInstructions.textContent =
            "Eye line created. Click again to reposition both points.";
    }
});

resetLineButton.addEventListener("click", function () {
    eyePoints = [];

    redrawCanvas();

    drawingInstructions.textContent =
        "Click the centre of the first eye, then the second eye.";
});

function redrawCanvas() {
    ctx.clearRect(
        0,
        0,
        drawingCanvas.width,
        drawingCanvas.height
    );

    ctx.strokeStyle = "#e53935";
    ctx.fillStyle = "#e53935";
    ctx.lineWidth = Math.max(2, drawingCanvas.width / 500);

    if (eyePoints.length === 1) {
        const point = eyePoints[0];

        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
        ctx.fill();

        return;
    }

    if (eyePoints.length === 2) {
        const first = eyePoints[0];
        const second = eyePoints[1];

        const dx = second.x - first.x;
        const dy = second.y - first.y;

        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
            ctx.beginPath();
            ctx.arc(first.x, first.y, 6, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        let start;
        let end;

        if (Math.abs(dx) < 0.001) {
            start = { x: first.x, y: 0 };
            end = { x: first.x, y: drawingCanvas.height };
        } else {
            const slope = dy / dx;

            start = {
                x: 0,
                y: first.y - first.x * slope
            };

            end = {
                x: drawingCanvas.width,
                y: first.y +
                    (drawingCanvas.width - first.x) * slope
            };
        }

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        eyePoints.forEach(function (point) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}