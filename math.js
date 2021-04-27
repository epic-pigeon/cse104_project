function Vec3(x, y, z) {
    if (!(this instanceof Vec3)) return new Vec3(...arguments); // allows for Vec3(x, y, z) syntax
    this.x = x;
    this.y = y;
    this.z = z;
}

function Vec4(a1, a2, a3, a4) {
    if (!(this instanceof Vec4)) return new Vec4(...arguments); // allows for Vec3(x, y, z) syntax
    this.a1 = a1;
    this.a2 = a2;
    this.a3 = a3;
    this.a4 = a4;
}

function Triangle(v1, v2, v3) {
    if (!(this instanceof Triangle)) return new Triangle(...arguments);
    this.v1 = v1;
    this.v2 = v2;
    this.v3 = v3;
}

function Mesh(arr) {
    if (!(this instanceof Mesh)) return new Mesh(...arguments);
    if (!Array.isArray(arr)) arr = [...arguments];
    this.triangles = arr;
}

function Matrix4x4(arr) {
    if (!(this instanceof Matrix4x4)) return new Matrix4x4(...arguments);
    this.elements = [...arguments];
}
Matrix4x4.prototype.multiplyVector = function (vec4) {
    let a1 = vec4.a1 * this.elements[0][0] + vec4.a2 * this.elements[1][0] + vec4.a3 * this.elements[2][0] + vec4.a4 * this.elements[3][0];
    let a2 = vec4.a1 * this.elements[0][1] + vec4.a2 * this.elements[1][1] + vec4.a3 * this.elements[2][1] + vec4.a4 * this.elements[3][1];
    let a3 = vec4.a1 * this.elements[0][2] + vec4.a2 * this.elements[1][2] + vec4.a3 * this.elements[2][2] + vec4.a4 * this.elements[3][2];
    let a4 = vec4.a1 * this.elements[0][3] + vec4.a2 * this.elements[1][3] + vec4.a3 * this.elements[2][3] + vec4.a4 * this.elements[3][3];
    return Vec4(a1, a2, a3, a4);
}

