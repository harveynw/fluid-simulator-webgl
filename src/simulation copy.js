import * as util from './util';
import { mat4 } from 'gl-matrix';

let viewRotation = [0,0,0];

class Simulation {
  constructor(gl, particles=100, gridResolution=[100,100,100]) {
    this.NUM_PARTICLES = 100;
    this.GRID_X_SIZE = gridResolution[0];
    this.GRID_Y_SIZE = gridResolution[1];
    this.GRID_Z_SIZE = gridResolution[2];

    this.half_float_extension = gl.getExtension('OES_texture_half_float');
    this.textureFormat = this.half_float_extension.HALF_FLOAT_OES;

    // Stores lagrangian particle position and velocites
    this.particlePositions = gl.createTexture();
    this.particleVelocities = gl.createTexture();

    // Simulation
    this.gridVelocity         = gl.createTexture();
    this.gridVelocityForces   = gl.createTexture();
    this.gridVelocityBoundary = gl.createTexture();
    this.gridLabels           = gl.createTexture();
    this.gridPsuedoPressure   = gl.createTexture();
    this.gridVelocitySolved   = gl.createTexture();

    this.setupTextures = this.setupTextures.bind(this);
  }

  setupTextures(gl) {
    
  }
}

function initSimulation(canvas) {
	const gl = util.initOpenGl(canvas);

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mousemove', onMouseMove);

	util.getShaderSources('vertex.vsh', 'frag.fsh').then(src => {
		startSimulation(gl, src[0], src[1]);
	});
}



function startSimulation(gl, vertexShaderSource, fragmentShaderSource) {
	let vertexShader = util.createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
	let fragmentShader = util.createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

	let program = util.createProgram(gl, vertexShader, fragmentShader);

	let positionAttributeLocation = gl.getAttribLocation(program, "a_position");
  let colorAttributeLocation = gl.getAttribLocation(program, "a_color");
	let matrixLocation = gl.getUniformLocation(program, "u_matrix");

	// Create a buffer
  let positionBuffer = gl.createBuffer();

  // Create a vertex array object (attribute state)
  let vao = gl.createVertexArray();

  // and make it the one we're currently working with
  gl.bindVertexArray(vao);

  // Turn on the attribute
  gl.enableVertexAttribArray(positionAttributeLocation);

  // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Set Geometry.
  setGeometry(gl);

  // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  let size = 3;          // 3 components per iteration
  let type = gl.FLOAT;   // the data is 32bit floats
  let normalize = false; // don't normalize the data
  let stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
  let offset = 0;        // start at the beginning of the buffer
  gl.vertexAttribPointer(
      positionAttributeLocation, size, type, normalize, stride, offset);

  // Set colors
  let colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  setColors(gl);

  gl.enableVertexAttribArray(colorAttributeLocation);
  size = 3;
  type = gl.UNSIGNED_BYTE;
  normalize = true;
  stride = 0;
  offset = 0;
  gl.vertexAttribPointer(colorAttributeLocation, size, type, normalize, stride, offset);

  drawScene();

  function drawScene() {
  	util.resizeToDisplay(gl.canvas);

  	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  	// Clear the canvas
  	gl.clearColor(0, 0, 0, 0);
  	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

  	// Tell it to use our program (pair of shaders)
  	gl.useProgram(program);

    gl.bindVertexArray(vao);

    // Compute Model-View-Projection matrix to pass to shader

    let projection = mat4.create();
    let modelview = mat4.create();
    let modelviewProjection = mat4.create();
    mat4.perspective(projection, 1, gl.canvas.clientWidth/gl.canvas.clientHeight, 0.05, 1000);
    mat4.lookAt(modelview, [-20,-20,20], [0,0,4], [0,0,1]);
    /* Apply the modeling tranformation to modelview. */
    let translation = [0, 0, 0];
    let degToRad = d => d * Math.PI / 180;
    let rotation = viewRotation.map(theta => degToRad(theta));
    let scale = [1, 1, 1];
    mat4.rotateX(modelview, modelview, rotation[0]);
    mat4.rotateY(modelview, modelview, rotation[1]);
    mat4.rotateZ(modelview, modelview, rotation[2]);
    mat4.scale(modelview, modelview, scale);
    mat4.translate(modelview, modelview, translation);
    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
     
    mat4.multiply( modelviewProjection, projection, modelview );
   
    // Set the matrix.
    gl.uniformMatrix4fv(matrixLocation, false, modelviewProjection);

  	// Draw the geometry.
    let primitiveType = gl.TRIANGLES;
    offset = 0;
    let count = 6 * 6 * 10 * 10 * 10;
    gl.drawArrays(primitiveType, offset, count);

    requestAnimationFrame(drawScene);
  }
}

function cubeVertices([x, y, z]) {
  let cube = [
            // first face
              0,   0,  0,
             1,   0,  0,
              0, 1,  0,
              0, 1,  0,
             1,   0,  0,
             1, 1,  0,
 
            // second face
             1,   0,  0,
            1,   1,  0,
             1,  0,  1,
             1,  0,  1,
            1,   1,  0,
            1,  1, 1,
 
            // third face
             0,   1,  0,
            1,   1,  0,
             0,  0,  1,
             0,  0,  1,
            1,   1,  0,
            1,  1, 1,

            // fourth face
             0,   0,  0,
             0,   1,  0,
             0,  0,  1,
             0,  0,  1,
            0,   1,  0,
            0,  1, 1,

            // fifth face
             0,   0,  0,
             0,   0,  1,
             1,  0,  0,
             1,  0,  0,
            0,   0,  1,
            1,  0, 1,

            // sixth face
             1,   0,  1,
             1,   1,  1,
             0,  0,  1,
             0,  0,  1,
            1,   1,  1,
            0,  1, 1];

  // Translate
  for(let vertex = 0; vertex < 36; vertex++){
    cube[vertex*3+0] += x;
    cube[vertex*3+1] += y;
    cube[vertex*3+2] += z;
  }

  return cube;
}

function setGeometry(gl) {

  let gridVertices = [];
  for(let x = -5; x < 5; x++) {
    for(let y = -5; y < 5; y++) {
      for(let z = 0; z < 10; z++) {
        gridVertices = gridVertices.concat(cubeVertices([x,y,z]));
      }
    }
  }

  gl.bufferData(
    gl.ARRAY_BUFFER,
    Float32Array.from(gridVertices),
    gl.STATIC_DRAW
  );
}

function setColors(gl) {

  //let colorData = Array.from({length: 6*6*3*10*10*10}, () => Math.floor(Math.random() * 255));
  let colorData = [];

  let colors = [
    13, 0, 255,
    0, 0, 163,
    51, 51, 255,
    51, 51, 255,
    0, 0, 163,
    22, 119, 199
  ];

  for(let cube = 0; cube < 10*10*10; cube++) {
    for(let face = 0; face < 6; face++) {
      colorData = colorData.concat(colors)
    }
  }

  gl.bufferData(
      gl.ARRAY_BUFFER,
      Uint8Array.from(colorData),
      gl.STATIC_DRAW
  );
}

let mouseDown = false;
let mouseLast = [0,0];
function recordMouse(event) {
  mouseLast = [event.clientX, event.clientY];
}

function onMouseDown(event) {
  mouseDown = true;
  recordMouse(event);
}

function onMouseUp(event) {
  mouseDown = false;
  recordMouse(event);
}

function onMouseMove(event) {
  if(!mouseDown) return;

  let deltaX = event.clientX - mouseLast[0]; 
  let deltaY = event.clientY - mouseLast[1];

  viewRotation[2] = viewRotation[2] + deltaX*0.1;
  //viewRotation[0] = viewRotation[0] + deltaY*0.1;

  recordMouse(event);
}

export { initSimulation };
