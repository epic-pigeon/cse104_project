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
Color.prototype.plus = function (other) {
    return Color(
        Math.min(1, this.r * this.a + other.r * other.a),
        Math.min(1, this.g * this.a + other.g * other.a),
        Math.min(1, this.b * this.a + other.b * other.a),
        Math.min(1, this.a + other.a)
    );
}
Color.prototype.applyTo = function (surfaceColor) {
    return Color(
        this.r * surfaceColor.r * this.a,
        this.g * surfaceColor.g * this.a,
        this.b * surfaceColor.b * this.a,
        surfaceColor.a
    )
}


function Surface(triangle, color) {
    if (!(this instanceof Surface)) return new Surface(...arguments);
    this.triangle = triangle;
    this.color = color || Color(1, 1, 1);
}


function Mesh(arr) {
    if (!(this instanceof Mesh)) return new Mesh(...arguments);
    if (!Array.isArray(arr)) arr = [...arguments];
    this.surfaces = arr.map(k => k instanceof Triangle ? Surface(k) : k);
}

Mesh.fromUint8Array = function (uint8array) {
    let ptr = 0;
    let vertices = [];
    let surfaces = [];
    function getStringUntilNewline() {
        let result = "";
        while (ptr < uint8array.length
        && uint8array[ptr] !== 0x0A /* '\n' */
        && uint8array[ptr] !== 0x0D /* '\r' */) {
            result += String.fromCharCode(uint8array[ptr]);
            ptr++;
        }
        ptr++;
        if (uint8array[ptr] === 0x0A) ptr++;
        return result;
    }
    while (ptr < uint8array.length) {
        let char = String.fromCharCode(uint8array[ptr]);
        ptr++;
        if (char === "\n" || char === "\r") continue;
        let line = getStringUntilNewline();
        if (char === "#") {
            // comment
        } else if (char === "v") {
            // vertex
            let [x, y, z] = line.split(/ +/).filter(k => k).map(n => parseFloat(n));
            vertices.push(Vec3(x, y, z));
        } else if (char === "f") {
            // face
            let [v1, v2, v3] = line.split(/ +/).filter(k => k).map(n => parseInt(n));
            surfaces.push(Triangle(vertices[v1-1], vertices[v2-1], vertices[v3-1]));
        } else {
            console.warn(`Unknown modifier ${char}: '${char}${line}'`);
        }
    }
    return Mesh(surfaces);
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
    drawTriangle(x1, y1, x2, y2, x3, y3, color) {
        throw new Error("interface");
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
    drawTriangle(x1, y1, x2, y2, x3, y3, color) {
        this.context.beginPath();
        this.context.moveTo(x1, y1);
        this.context.lineTo(x2, y2);
        this.context.lineTo(x3, y3);
        this.context.lineTo(x1, y1);
        this.context.fillStyle = color.toCSSColor();
        this.context.fill();
        this.context.strokeStyle = color.toCSSColor();
        this.context.strokeWidth = 1;
        this.context.stroke();
    }
}

class BaseEngine {
    constructor(display) {
        this.display = display;
        this.keyState = {};
        let time = 0;
        const __update = t => {
            if (t > 0) {
                let d = t - time;
                this.update(d / 1000);
                time = t;
                this.mouseMovementX = 0;
                this.mouseMovementY = 0;
            }
            this.handler = window.requestAnimationFrame(__update);
        }
        this.start = async () => {
            let res = this.init();
            if (res instanceof Promise) await res;
            window.onkeydown = e => {
                this.keyState[e.code] = true;
            }
            window.onkeyup = e => {
                delete this.keyState[e.code];
            }
            __update(0);
        }
        this.mouseMovementX = 0;
        this.mouseMovementY = 0;
        window.onmousemove = e => {
            let d = this.display.getDimensions();
            let m = Math.min(d.height, d.width)
            this.mouseMovementX += e.movementX / m;
            this.mouseMovementY += e.movementY / m;
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


class Camera {
    constructor(options) {
        this.location = options.location;
        this.direction = options.direction || Vec3(0, 0, 1)
    }
}


class LightSource {
    constructor(location) {
        this.location = location;
    }
    getLightColor(location, normal) {
        throw new Error("interface lol");
    }
}


class UniformDirectionalLightSource extends LightSource {
    constructor(direction, color) {
        super(Vec3(0, 0, 0)); // location does not matter
        this.direction = direction.normalize(); this.color = color;
    }
    getLightColor(location, normal) {
        let c = Math.max(0, -this.direction.dotProduct(normal));
        return Color(this.color.r * c, this.color.g * c, this.color.b * c, this.color.a);
    }
}


class Engine3D extends BaseEngine {
    constructor(display, options) {
        super(display);
        this.options = Object.assign({
            zNear: 0.1,
            zFar: 1000,
            fov: 90
        }, options || {});
        this.meshes = [];
        this.lightSources = [];
    }
    buildProjectionMatrix() {
        let zNear = this.options.zNear, zFar = this.options.zFar, fov = this.options.fov,
            aspectRatio = this.display.getDimensions().height / this.display.getDimensions().width,
            fovRad = 1 / Math.tan(fov * 0.5 / 180 * Math.PI);
        return Matrix4x4(
            [aspectRatio * fovRad, 0,      0,                              0],
            [0,                    fovRad, 0,                              0],
            [0,                    0,      zFar / (zFar - zNear),          1],
            [0,                    0,      -zFar * zNear / (zFar - zNear), 0],
        );
    }
    init() {
        this.projectionMatrix = this.buildProjectionMatrix();
    }
    multiplyMatrix(vec3, matrix) {
        let res = matrix.multiplyVector(Vec4(vec3.x, vec3.y, vec3.z, 1));
        if (res.a4 === 0) res.a4 = 1;
        return Vec3(res.a1 / res.a4, res.a2 / res.a4, res.a3 / res.a4);
    }
    transformMesh(mesh, f) {
        return Mesh(mesh.surfaces.map(s => Surface(Triangle(f(s.triangle.v1), f(s.triangle.v2), f(s.triangle.v3)), s.color)));
    }
    update(delta) {
        let {height, width} = this.display.getDimensions();
        this.display.fill(0, 0, width, height, Color(0, 0, 0));
        if (this.prevHeight && this.prevWidth) {
            if (this.prevHeight !== height || this.prevWidth !== width) {
                this.projectionMatrix = this.buildProjectionMatrix();
            }
        }
        this.prevHeight = height;
        this.prevWidth = width;
        let toDraw = [];
        for (let mesh of this.meshes) {
            for (let surface of mesh.surfaces) {
                let triangle = surface.triangle;
                let line1 = triangle.v2.minus(triangle.v1), line2 = triangle.v3.minus(triangle.v1), normal = line1.crossProduct(line2);
                if (normal.dotProduct(triangle.v1.minus(this.camera.location)) <= 0) {
                    toDraw.push(surface);
                }
            }
        }
        toDraw.sort((s1, s2) => {
            let z1 = s1.triangle.v1.z + s1.triangle.v2.z + s1.triangle.v3.z;
            let z2 = s2.triangle.v1.z + s2.triangle.v2.z + s2.triangle.v3.z;
            return z2 - z1;
        });
        let {x, y} = this.camera.direction.toAngle();
        let mX = Matrix4x4.rotationMatrixX(x);
        let mY = Matrix4x4.rotationMatrixY(y);
        for (let surface of toDraw) {
            let triangle = surface.triangle,
                line1 = triangle.v2.minus(triangle.v1), line2 = triangle.v3.minus(triangle.v1),
                normal = line1.crossProduct(line2);
            let lightColor = Color(0, 0, 0);
            for (let lightSource of this.lightSources) {
                let c = lightSource.getLightColor(triangle.v1.minus(lightSource.location), normal.normalize());
                lightColor = lightColor.plus(c);
            }
            let translated = Triangle(
                triangle.v1.minus(this.camera.location),
                triangle.v2.minus(this.camera.location),
                triangle.v3.minus(this.camera.location)
            );
            let projected = Triangle(
                this.multiplyMatrix(translated.v1, this.projectionMatrix),
                this.multiplyMatrix(translated.v2, this.projectionMatrix),
                this.multiplyMatrix(translated.v3, this.projectionMatrix)
            );
            let x1 = (projected.v1.x + 1) / 2 * width, y1 = (projected.v1.y + 1) / 2 * height;
            let x2 = (projected.v2.x + 1) / 2 * width, y2 = (projected.v2.y + 1) / 2 * height;
            let x3 = (projected.v3.x + 1) / 2 * width, y3 = (projected.v3.y + 1) / 2 * height;
            this.display.drawTriangle(x1, y1, x2, y2, x3, y3, lightColor.applyTo(surface.color));
        }
    }
}


class MyEngine extends Engine3D {
    constructor(display, options) {
        super(display, options);
    }
    async init() {
        super.init();
        this.camera = new Camera({location: Vec3(0, 0, 0), direction: Vec3(0, 0, 1)});
        this.theta = 0;
        this.angleX = 0;
        this.angleY = 0;
        this.sensitivity = 10;
        this.lightSources.push(new UniformDirectionalLightSource(Vec3(0, 0, 1), Color(1, 1, 1)));
        let r;
        try {
            r = await fetch("starship.obj");
        } catch (e) {
            r = {ok: false};
        }
        if (r.ok) {
            this.cube = Mesh.fromUint8Array(new Uint8Array(await r.arrayBuffer()))
        } else {
            this.cube = Mesh(
                // south
                Surface(Triangle(Vec3(0, 0, 0), Vec3(0, 1, 0), Vec3(1, 1, 0)), Color(1, 0, 0)),
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
        }
    }
    update(delta) {
        let movement = Vec3(
            delta * (this.keyState["KeyD"] ? 1 : this.keyState["KeyA"] ? -1 : 0),
            delta * (this.keyState["ControlLeft"] ? 1 : this.keyState["ShiftLeft"] ? -1 : 0),
            delta * (this.keyState["KeyW"] ? 1 : this.keyState["KeyS"] ? -1 : 0)
        );
        this.camera = new Camera({
            location: this.camera.location.plus(movement.multiply(3))
        });
        document.title = `Game (FPS: ${1 / delta})`;
        this.theta += delta;
        let matrixZ = Matrix4x4.rotationMatrixZ(this.theta);
        let matrixX = Matrix4x4.rotationMatrixX(this.theta / 2);
        this.meshes = [
            this.transformMesh(
                this.transformMesh(
                    this.transformMesh(
                        this.cube,
                        v => this.multiplyMatrix(v, matrixZ)
                    ),
                    v => this.multiplyMatrix(v, matrixX)
                ),
                v => Vec3(v.x, v.y, v.z + 3)
            )
        ];
        super.update(delta);
    }
    cleanup() {

    }
}