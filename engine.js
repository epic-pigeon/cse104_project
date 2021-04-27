function Color(r, g, b, a) {
    if (!(this instanceof Color)) return new Color(...arguments);
    if (typeof r === 'string') {
        // Color("FFFFFF"[, alpha])
        this.r = parseInt(r.slice(0, 2), 16) / 255;
        this.g = parseInt(r.slice(0, 2), 16) / 255;
        this.b = parseInt(r.slice(0, 2), 16) / 255;
        this.a = typeof g === "number" ? g : 1.0;
    } else {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = typeof a === "number" ? a : 1.0;
    }
}
Color.prototype.toCSSColor = function () {
    return `rgba(${parseInt(this.r * 255.9)}, ${parseInt(this.g * 255.9)}, ${parseInt(this.b * 255.9)}, ${this.a})`
}

class IDisplay {
    getDimensions() {
        throw new Error("interface")
    }
    fill(x1, y1, x2, y2, color) {
        throw new Error("interface");
    }
    strokeLine(x1, y1, x2, y2, color) {
        throw new Error("interface");
    }
    strokeTriangle(x1, y1, x2, y2, x3, y3, color) {
        this.strokeLine(x1, y1, x2, y2, color);
        this.strokeLine(x2, y2, x3, y3, color);
        this.strokeLine(x1, y1, x3, y3, color);
    }
}

class CanvasDisplay extends IDisplay {
    constructor(canvas) {
        super();
        this.context = (this.canvas = canvas).getContext("2d");
    }
    getDimensions() {
        return {
            height: this.canvas.height,
            width: this.canvas.width
        }
    }
    fill(x1, y1, x2, y2, color) {
        this.context.beginPath();
        this.context.rect(x1, y1, x2, y2);
        this.context.fillStyle = color.toCSSColor();
        this.context.fill();
    }
    strokeLine(x1, y1, x2, y2, color) {
        this.context.beginPath();
        this.context.moveTo(x1, y1);
        this.context.lineTo(x2, y2);
        this.context.strokeStyle = color.toCSSColor();
        this.context.strokeWidth = 1;
        this.context.stroke();
    }
    strokeTriangle(x1, y1, x2, y2, x3, y3, color) {
        this.context.beginPath();
        this.context.moveTo(x1, y1);
        this.context.lineTo(x2, y2);
        this.context.lineTo(x3, y3);
        this.context.lineTo(x1, y1);
        this.context.strokeStyle = color.toCSSColor();
        this.context.strokeWidth = 1;
        this.context.stroke();
    }
}

class BaseEngine {
    constructor(display) {
        this.display = display;
        this.keyState = [];
        let time = 0;
        const update = t => {
            if (t > 0) {
                let d = t - time;
                this.update(d / 1000);
                time = t;
            }
            this.handler = window.requestAnimationFrame(update);
        }
        this.start = () => {
            this.init();
            window.onkeydown = e => {
                this.keyState[e.key] = true;
            }
            window.onkeyup = e => {
                delete this.keyState[e.key];
            }
            update(0);
        }
    }
    init() {
        throw new Error("unimplemented");
    }
    update(delta) {
        throw new Error("unimplemented");
    }
    cleanup() {
        throw new Error("unimplemented");
    }
    stop() {
        window.cancelAnimationFrame(this.handler);
        this.cleanup();
    }
}


class MyEngine extends BaseEngine {
    constructor(display, options) {
        super(display);
        this.options = Object.assign({
            zNear: 0.1,
            zFar: 1000,
            fov: 90
        }, options || {})
    }
    init() {
        this.cube = Mesh(
            // south
            Triangle(Vec3(0, 0, 0), Vec3(0, 1, 0), Vec3(1, 1, 0)),
            Triangle(Vec3(0, 0, 0), Vec3(1, 1, 0), Vec3(1, 0, 0)),

            // east
            Triangle(Vec3(1, 0, 0), Vec3(1, 1, 0), Vec3(1, 1, 1)),
            Triangle(Vec3(1, 0, 0), Vec3(1, 1, 1), Vec3(1, 0, 1)),

            // north
            Triangle(Vec3(1, 0, 1), Vec3(1, 1, 1), Vec3(0, 1, 1)),
            Triangle(Vec3(1, 0, 1), Vec3(0, 1, 1), Vec3(0, 0, 1)),

            // west
            Triangle(Vec3(0, 0, 1), Vec3(0, 1, 1), Vec3(0, 1, 0)),
            Triangle(Vec3(0, 0, 1), Vec3(0, 1, 0), Vec3(0, 0, 0)),

            // top
            Triangle(Vec3(0, 1, 0), Vec3(0, 1, 1), Vec3(1, 1, 1)),
            Triangle(Vec3(0, 1, 0), Vec3(1, 1, 1), Vec3(1, 1, 0)),

            // bottom
            Triangle(Vec3(1, 0, 1), Vec3(0, 0, 1), Vec3(0, 0, 0)),
            Triangle(Vec3(1, 0, 1), Vec3(0, 0, 0), Vec3(1, 0, 0)),
        );
        this.buildProjectionMatrix();
        this.theta = 0;
    }
    buildProjectionMatrix() {
        let zNear = this.options.zNear, zFar = this.options.zFar, fov = this.options.fov,
            aspectRatio = this.display.getDimensions().height / this.display.getDimensions().width,
            fovRad = 1 / Math.tan(fov * 0.5 / 180 * Math.PI);
        this.projectionMatrix = Matrix4x4(
            [aspectRatio * fovRad, 0,      0,                              0],
            [0,                    fovRad, 0,                              0],
            [0,                    0,      zFar / (zFar - zNear),          1],
            [0,                    0,      -zFar * zNear / (zFar - zNear), 0],
        );
    }
    multiplyMatrix(vec3, matrix) {
        let res = matrix.multiplyVector(Vec4(vec3.x, vec3.y, vec3.z, 1));
        if (res.a4 === 0) res.a4 = 1;
        return Vec3(res.a1 / res.a4, res.a2 / res.a4, res.a3 / res.a4);
    }
    update(delta) {
        document.title = `Game (FPS: ${1 / delta})`;
        let {height, width} = this.display.getDimensions();
        this.display.fill(0, 0, width, height, Color(0, 0, 0));
        if (this.prevHeight && this.prevWidth) {
            if (this.prevHeight !== height || this.prevWidth !== width) {
                this.buildProjectionMatrix();
            }
        }
        this.prevHeight = height;
        this.prevWidth = width;
        let color = new Color(1, 1, 1);
        this.theta += delta;
        let matrixZ = new Matrix4x4(
            [Math.cos(this.theta),  Math.sin(this.theta), 0, 0],
            [-Math.sin(this.theta), Math.cos(this.theta), 0, 0],
            [0,                     0,                    1, 0],
            [0,                     0,                    0, 1]
        );
        let matrixX = new Matrix4x4(
            [1, 0,                       0,                      0],
            [0, Math.cos(this.theta/2),  Math.sin(this.theta/2), 0],
            [0, -Math.sin(this.theta/2), Math.cos(this.theta/2), 0],
            [0, 0,                       0,                      1]
        );
        for (let triangle of this.cube.triangles) {
            let rotatedTriangle = Triangle(
                this.multiplyMatrix(this.multiplyMatrix(triangle.v1, matrixZ), matrixX),
                this.multiplyMatrix(this.multiplyMatrix(triangle.v2, matrixZ), matrixX),
                this.multiplyMatrix(this.multiplyMatrix(triangle.v3, matrixZ), matrixX),
            );
            let translatedTriangle = Triangle(
                Vec3(rotatedTriangle.v1.x, rotatedTriangle.v1.y, rotatedTriangle.v1.z + 3),
                Vec3(rotatedTriangle.v2.x, rotatedTriangle.v2.y, rotatedTriangle.v2.z + 3),
                Vec3(rotatedTriangle.v3.x, rotatedTriangle.v3.y, rotatedTriangle.v3.z + 3)
            );

            let projected = Triangle(
                this.multiplyMatrix(translatedTriangle.v1, this.projectionMatrix),
                this.multiplyMatrix(translatedTriangle.v2, this.projectionMatrix),
                this.multiplyMatrix(translatedTriangle.v3, this.projectionMatrix)
            );
            let x1 = (projected.v1.x + 1) / 2 * width, y1 = (projected.v1.y + 1) / 2 * height;
            let x2 = (projected.v2.x + 1) / 2 * width, y2 = (projected.v2.y + 1) / 2 * height;
            let x3 = (projected.v3.x + 1) / 2 * width, y3 = (projected.v3.y + 1) / 2 * height;
            this.display.strokeTriangle(x1, y1, x2, y2, x3, y3, color);
        }
    }
    cleanup() {

    }
}

