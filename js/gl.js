// Music Box Studio: a tiny WebGL 2 renderer, written from scratch (no Three.js).
// Matrix maths, a few shape builders, and one shader with soft studio lighting for
// glossy lacquer, polished metal and velvet.

// ---------------------------------------------------------------- matrices (column-major, like WebGL)
export const mat4 = {
  identity: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  multiply(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c += 1) {
      for (let r = 0; r < 4; r += 1) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  },
  mul(...ms) { return ms.reduce((acc, m) => mat4.multiply(acc, m)); },
  translate: (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]),
  scale: (x, y = x, z = x) => new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]),
  rotateX(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); },
  rotateY(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); },
  rotateZ(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
  perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  },
  lookAt(eye, target, up = [0, 1, 0]) {
    const z = norm(sub(eye, target));
    const x = norm(cross(up, z));
    const y = cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
      -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
  },
  apply(m, [x, y, z]) {
    return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14], m[3] * x + m[7] * y + m[11] * z + m[15]];
  },
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ---------------------------------------------------------------- shapes
// Each returns { positions, normals, uvs, indices } (plain arrays), centred on the origin.

function grid(push, nu, nv, fn) {
  // fn(u, v) → { p, n, uv }
  const start = push.count;
  for (let j = 0; j <= nv; j += 1) for (let i = 0; i <= nu; i += 1) push.vertex(fn(i, j));
  for (let j = 0; j < nv; j += 1) {
    for (let i = 0; i < nu; i += 1) {
      const a = start + j * (nu + 1) + i;
      const b = a + 1;
      const c = a + nu + 1;
      const d = c + 1;
      push.tri(a, b, d);
      push.tri(a, d, c);
    }
  }
}

function builder() {
  const g = { positions: [], normals: [], uvs: [], indices: [], count: 0 };
  g.vertex = ({ p, n, uv = [0, 0] }) => { g.positions.push(...p); g.normals.push(...n); g.uvs.push(...uv); g.count += 1; };
  // add a triangle, making sure it faces the same way as its normals (counter-clockwise from outside)
  g.tri = (a, b, c) => {
    const P = (i) => g.positions.slice(i * 3, i * 3 + 3);
    const N = (i) => g.normals.slice(i * 3, i * 3 + 3);
    const cr = cross(sub(P(b), P(a)), sub(P(c), P(a)));
    const n = [0, 1, 2].map((k) => N(a)[k] + N(b)[k] + N(c)[k]);
    if (dot(cr, n) < 0) g.indices.push(a, c, b); else g.indices.push(a, b, c);
  };
  return g;
}

// A box with softly rounded edges (radius r). Built from six face grids whose rows/columns
// bunch up near the edges, then each point is pushed out onto the rounded corner.
export function roundedBox(w, h, d, r = 0.2, k = 4) {
  const half = [w / 2, h / 2, d / 2];
  r = Math.min(r, ...half);
  const coords = (hl) => {
    const c = [];
    for (let i = 0; i <= k; i += 1) c.push(-hl + r - r * Math.cos((i / k) * Math.PI / 2));
    for (let i = 0; i <= k; i += 1) c.push(hl - r + r * Math.sin((i / k) * Math.PI / 2));
    return c;
  };
  const cs = half.map(coords);
  const g = builder();
  const faces = [ // [axis, sign, uAxis, vAxis]
    [0, 1, 2, 1], [0, -1, 2, 1], [1, 1, 0, 2], [1, -1, 0, 2], [2, 1, 0, 1], [2, -1, 0, 1],
  ];
  for (const [ax, sign, ua, va] of faces) {
    const cu = cs[ua];
    const cv = cs[va];
    const start = g.count;
    for (let j = 0; j < cv.length; j += 1) {
      for (let i = 0; i < cu.length; i += 1) {
        const p = [0, 0, 0];
        p[ax] = sign * half[ax];
        p[ua] = cu[i];
        p[va] = cv[j];
        const inner = p.map((v, a) => Math.max(-half[a] + r, Math.min(half[a] - r, v)));
        let n = sub(p, inner);
        const len = Math.hypot(...n);
        n = len > 1e-6 ? n.map((v) => v / len) : (() => { const t = [0, 0, 0]; t[ax] = sign; return t; })();
        const pos = len > 1e-6 ? inner.map((v, a) => v + n[a] * r) : p;
        g.vertex({ p: pos, n, uv: [(p[ua] / half[ua] + 1) / 2, (p[va] / half[va] + 1) / 2] });
      }
    }
    const nu = cu.length - 1;
    for (let j = 0; j < cv.length - 1; j += 1) {
      for (let i = 0; i < nu; i += 1) {
        const a = start + j * (nu + 1) + i;
        const b = a + 1;
        const c = a + nu + 1;
        const dd = c + 1;
        g.tri(a, b, dd);
        g.tri(a, dd, c);
      }
    }
  }
  return g;
}

export const box = (w, h, d) => roundedBox(w, h, d, 0.0001, 1);

// A flat rectangle facing +z (for textures: the engraved plate, the note in the lid).
export function plane(w, h) {
  const g = builder();
  grid(g, 1, 1, (i, j) => ({ p: [(i - 0.5) * w, (j - 0.5) * h, 0], n: [0, 0, 1], uv: [i, 1 - j] }));
  return g;
}

// A cylinder lying along the x axis.
export function cylinder(r, len, seg = 32, caps = true) {
  const g = builder();
  grid(g, seg, 1, (i, j) => {
    const a = (i / seg) * Math.PI * 2;
    const y = Math.cos(a);
    const z = Math.sin(a);
    return { p: [(j - 0.5) * len, y * r, z * r], n: [0, y, z], uv: [i / seg, j] };
  });
  if (caps) {
    for (const side of [-1, 1]) {
      const centre = g.count;
      g.vertex({ p: [side * len / 2, 0, 0], n: [side, 0, 0], uv: [0.5, 0.5] });
      for (let i = 0; i <= seg; i += 1) {
        const a = (i / seg) * Math.PI * 2;
        g.vertex({ p: [side * len / 2, Math.cos(a) * r, Math.sin(a) * r], n: [side, 0, 0], uv: [0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2] });
      }
      for (let i = 0; i < seg; i += 1) {
        if (side > 0) g.tri(centre, centre + 1 + i, centre + 2 + i);
        else g.tri(centre, centre + 2 + i, centre + 1 + i);
      }
    }
  }
  return g;
}

export function sphere(r, seg = 16) {
  const g = builder();
  grid(g, seg * 2, seg, (i, j) => {
    const th = (j / seg) * Math.PI;
    const ph = (i / (seg * 2)) * Math.PI * 2;
    const n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
    return { p: n.map((v) => v * r), n, uv: [i / (seg * 2), j / seg] };
  });
  return g;
}

// A shape turned around the y axis, like wood on a lathe. profile = [[radius, y], ...] from bottom to top.
export function lathe(profile, seg = 32) {
  const g = builder();
  const n = profile.length;
  const normals2d = profile.map((_, i) => {
    const a = profile[Math.max(0, i - 1)];
    const b = profile[Math.min(n - 1, i + 1)];
    const dr = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dr, dy) || 1;
    return [dy / l, -dr / l];
  });
  grid(g, seg, n - 1, (i, j) => {
    const a = (i / seg) * Math.PI * 2;
    const [rr, y] = profile[j];
    const [nr, ny] = normals2d[j];
    return { p: [Math.cos(a) * rr, y, Math.sin(a) * rr], n: [Math.cos(a) * nr, ny, Math.sin(a) * nr], uv: [i / seg, j / (n - 1)] };
  });
  for (const [idx, ny] of [[0, -1], [n - 1, 1]]) {
    const [rr, y] = profile[idx];
    if (rr < 1e-4) continue;
    const centre = g.count;
    g.vertex({ p: [0, y, 0], n: [0, ny, 0] });
    for (let i = 0; i <= seg; i += 1) {
      const a = (i / seg) * Math.PI * 2;
      g.vertex({ p: [Math.cos(a) * rr, y, Math.sin(a) * rr], n: [0, ny, 0] });
    }
    for (let i = 0; i < seg; i += 1) g.tri(centre, centre + 1 + i, centre + 2 + i);
  }
  return g;
}

// Many copies of one shape baked into a single mesh (e.g. hundreds of pins = one draw call).
export function merge(parts) {
  const g = builder();
  for (const { geo, matrix } of parts) {
    const start = g.count;
    for (let i = 0; i < geo.positions.length / 3; i += 1) {
      const p = mat4.apply(matrix, geo.positions.slice(i * 3, i * 3 + 3));
      const n4 = mat4.apply(matrix, geo.normals.slice(i * 3, i * 3 + 3));
      const n = norm([n4[0] - matrix[12], n4[1] - matrix[13], n4[2] - matrix[14]]);
      g.vertex({ p: [p[0], p[1], p[2]], n, uv: geo.uvs.slice(i * 2, i * 2 + 2) });
    }
    for (let t = 0; t < geo.indices.length; t += 3) g.tri(start + geo.indices[t], start + geo.indices[t + 1], start + geo.indices[t + 2]);
  }
  return g;
}

// ---------------------------------------------------------------- renderer
const VERT = `#version 300 es
in vec3 aPos; in vec3 aNormal; in vec2 aUv;
uniform mat4 uModel, uViewProj;
out vec3 vWorld; out vec3 vNormal; out vec2 vUv; out vec3 vLocal; out vec3 vLocalN;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vLocal = aPos;
  vLocalN = aNormal;
  vNormal = mat3(uModel) * aNormal;
  vUv = aUv;
  gl_Position = uViewProj * w;
}`;

const FRAG = `#version 300 es
precision highp float;
in vec3 vWorld; in vec3 vNormal; in vec2 vUv; in vec3 vLocal; in vec3 vLocalN;
uniform vec3 uCam, uColor;
uniform int uPlanar;          // 1 = repeat the texture across each face (patterned box finishes)
uniform float uTexScale;
uniform float uMetal, uGloss, uAlpha, uVelvet, uGlow;
uniform int uMode;            // 0 lit, 1 soft shadow (alpha from texture)
uniform int uUseTex;
uniform sampler2D uTex;
out vec4 o;

// a soft photo-studio "room" for reflections: warm floor, pale walls, two soft boxes
vec3 env(vec3 r) {
  float t = clamp(r.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 c = mix(vec3(0.74, 0.66, 0.66), vec3(1.0, 0.97, 0.96), smoothstep(0.25, 0.7, t));
  c += vec3(1.7) * pow(max(dot(r, normalize(vec3(-0.45, 0.75, 0.55))), 0.0), 30.0);
  c += vec3(0.95, 0.88, 0.98) * 0.7 * pow(max(dot(r, normalize(vec3(0.8, 0.35, 0.45))), 0.0), 14.0);
  return c;
}

void main() {
  vec2 uv = vUv;
  if (uPlanar == 1) {
    // pick the flat projection that matches the way this part of the surface faces
    vec3 an = abs(normalize(vLocalN));
    uv = an.x > an.y && an.x > an.z ? vec2(vLocal.z, -vLocal.y)
       : an.y > an.z ? vec2(vLocal.x, vLocal.z)
       : vec2(vLocal.x, -vLocal.y);
    uv *= uTexScale;
  }
  vec4 tex = uUseTex == 1 ? texture(uTex, uv) : vec4(0.0);
  if (uMode == 1) { o = vec4(0.0, 0.0, 0.0, tex.a * uAlpha); return; }
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(uCam - vWorld);
  vec3 base = mix(uColor, tex.rgb, tex.a);
  vec3 L1 = normalize(vec3(-0.5, 0.9, 0.65));
  vec3 L2 = normalize(vec3(0.8, 0.45, -0.25));
  float nv = max(dot(n, v), 0.0);
  float diffuse = max(dot(n, L1), 0.0) * 0.8 + max(dot(n, L2), 0.0) * 0.28 + 0.34;
  vec3 r = reflect(-v, n);
  float fres = pow(1.0 - nv, 5.0);
  float shin = mix(10.0, 180.0, uGloss);
  float spec = pow(max(dot(n, normalize(L1 + v)), 0.0), shin) * (shin + 8.0) / 60.0;
  vec3 col;
  if (uGlow > 0.5) { o = vec4(base * uAlpha, uAlpha); return; }
  if (uMetal > 0.5) {
    col = base * env(r) * 0.95 + base * spec * 0.6;
  } else if (uVelvet > 0.5) {
    col = base * (diffuse * 0.9) + base * pow(1.0 - nv, 2.5) * 0.7;
  } else {
    col = base * diffuse + env(r) * (0.03 + 0.55 * fres) * uGloss + vec3(spec) * uGloss * 0.45;
  }
  col = col / (1.0 + col * 0.12);
  o = vec4(col * uAlpha, uAlpha);
}`;

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true });
  if (!gl) return null;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.bindAttribLocation(prog, 0, 'aPos');
  gl.bindAttribLocation(prog, 1, 'aNormal');
  gl.bindAttribLocation(prog, 2, 'aUv');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const u = {};
  for (const name of ['uModel', 'uViewProj', 'uCam', 'uColor', 'uMetal', 'uGloss', 'uAlpha', 'uVelvet', 'uGlow', 'uMode', 'uUseTex', 'uTex', 'uPlanar', 'uTexScale']) {
    u[name] = gl.getUniformLocation(prog, name);
  }
  gl.uniform1i(u.uTex, 0);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  function mesh(geo) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffers = [];
    [[geo.positions, 3], [geo.normals, 3], [geo.uvs, 2]].forEach(([data, size], loc) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      buffers.push(b);
    });
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    const big = geo.positions.length / 3 > 65535;
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(geo.indices) : new Uint16Array(geo.indices), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return {
      vao, count: geo.indices.length, type: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
      dispose() { buffers.forEach((b) => gl.deleteBuffer(b)); gl.deleteBuffer(ib); gl.deleteVertexArray(vao); },
    };
  }

  function texture(source, { repeat = false } = {}) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    const wrap = repeat ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE;   // mirrored so the edges of a photo meet seamlessly
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    return {
      update(src) { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.generateMipmap(gl.TEXTURE_2D); },
      handle: t,
    };
  }

  let viewProj = mat4.identity();
  return {
    gl,
    mesh,
    texture,
    begin(vp, cam, width, height) {
      viewProj = vp;
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(u.uViewProj, false, vp);
      gl.uniform3fv(u.uCam, cam);
    },
    draw(m, model, mat) {
      gl.uniformMatrix4fv(u.uModel, false, model);
      gl.uniform3fv(u.uColor, mat.color || [1, 1, 1]);
      gl.uniform1f(u.uMetal, mat.metal ? 1 : 0);
      gl.uniform1f(u.uVelvet, mat.velvet ? 1 : 0);
      gl.uniform1f(u.uGlow, mat.glow ? 1 : 0);
      gl.uniform1f(u.uGloss, mat.gloss ?? 0.5);
      gl.uniform1f(u.uAlpha, mat.alpha ?? 1);
      gl.uniform1i(u.uMode, mat.shadow ? 1 : 0);
      gl.uniform1i(u.uUseTex, mat.tex ? 1 : 0);
      gl.uniform1i(u.uPlanar, mat.planar ? 1 : 0);
      gl.uniform1f(u.uTexScale, mat.texScale || 1);
      if (mat.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, mat.tex.handle); }
      if (mat.doubleSided) gl.disable(gl.CULL_FACE);
      if (mat.alpha !== undefined && mat.alpha < 1) gl.depthMask(false);
      gl.bindVertexArray(m.vao);
      gl.drawElements(gl.TRIANGLES, m.count, m.type, 0);
      gl.depthMask(true);
      if (mat.doubleSided) gl.enable(gl.CULL_FACE);
    },
    project(point) {
      const p = mat4.apply(viewProj, point);
      return p[3] > 0 ? [p[0] / p[3], p[1] / p[3]] : null; // -1..1 screen coordinates
    },
  };
}
