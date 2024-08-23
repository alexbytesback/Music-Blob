const vertexShaderSource = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_audioData;

vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                   dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
               mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                   dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}

vec3 getGradientColor(float t) {
    vec3 pink = vec3(211.0/255.0, 37.0/255.0, 178.0/255.0);
    vec3 yellow = vec3(203.0/255.0, 168.0/255.0, 24.0/255.0);
    float cycle = fract(t);
    if (cycle < 0.5) {
        return mix(pink, yellow, cycle * 2.0);
    } else {
        return mix(yellow, pink, (cycle - 0.5) * 2.0);
    }
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    uv = uv * 2.0 - 1.0;

    // Aspect ratio correction
    uv.x *= u_resolution.x / u_resolution.y;

    // Parameters
    float radius = 0.5 + u_audioData * 0.5; // Diameter equal to the current width and influenced by audio data
    float edgeThickness = 0.05;

    // Distance field for the circle
    float dist = length(uv) - radius;

    // Enhanced noise effect for the splotchy edges
    float n = noise(uv * 4.0 + vec2(u_time * 0.5, u_time * 0.5)) * 0.1;
    n += noise(uv * 8.0 + vec2(u_time * 0.3, -u_time * 0.3)) * 0.05;

    // Gooey edge effect
    float edge = smoothstep(edgeThickness, 0.0, dist + n);

    // Gradient color that pans from left to right over time
    float gradientSpeed = 0.02; // Reduced gradient speed
    float gradientPosition = fract(uv.x * 0.25 - u_time * gradientSpeed); // Shorten the gradient length
    vec3 color = getGradientColor(gradientPosition);

    // Apply the edge effect
    color *= edge;

    gl_FragColor = vec4(color, edge);
}
`;

const createShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
};

const createProgram = (gl, vertexShader, fragmentShader) => {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
};

const main = () => {
    const canvas = document.getElementById("canvas"),
          gl = canvas.getContext("webgl", { alpha: true });

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vertexShader, fragmentShader);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);

    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const audioDataLocation = gl.getUniformLocation(program, "u_audioData");

    // Audio setup
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const audio = new Audio('utomp3.com - Taylor Swift  Blank Space.mp3');
    audio.crossOrigin = "anonymous";
    const source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    source.connect(audioCtx.destination);

    const toggleAudio = () => {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
        }
    };

    // Toggle audio on click
    document.addEventListener('click', toggleAudio);

    const render = time => {
        time *= 0.001;

        gl.canvas.width = gl.canvas.clientWidth;
        gl.canvas.height = gl.canvas.clientHeight;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);
        gl.uniform1f(timeLocation, time);

        // Get audio data
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        const audioData = average / 256.0; // Normalize audio data

        gl.uniform1f(audioDataLocation, audioData);

        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
};

main();