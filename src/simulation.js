import * as util from './util';
import { mat4 } from 'gl-matrix';
import Controller from './controller';

import * as stage_label_grid from './stages/label_grid';
import * as stage_to_mac_grid from './stages/to_mac_grid';

class Simulation {
	constructor(canvas, gl, particles=100, gridResolution=[100,100,100]) {
   	this.controller = new Controller(canvas);

   	this.NUM_PARTICLES = 1000;
   	this.GRID_X_SIZE = gridResolution[0];
   	this.GRID_Y_SIZE = gridResolution[1];
   	this.GRID_Z_SIZE = gridResolution[2];

   	this.GRID_X_STEP = 1/gridResolution[0];
   	this.GRID_Y_STEP = 1/gridResolution[1];
   	this.GRID_Z_STEP = 1/gridResolution[2];

   	// Stores lagrangian particle position and velocites
   	this.particlePositions = gl.createTexture();
   	this.particleVelocities = gl.createTexture();

   	// Simulation
   	this.gridVelocity         = gl.createTexture();
   	this.gridVelocitySum      = gl.createTexture();
   	this.gridVelocityWeight   = gl.createTexture();

   	this.gridVelocityForces   = gl.createTexture();
   	this.gridVelocityBoundary = gl.createTexture();
   	this.gridLabels           = gl.createTexture();
   	this.gridPsuedoPressure   = gl.createTexture();
   	this.gridVelocitySolved   = gl.createTexture();

   	gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	}

}

function initSimulation(canvas) {
	const gl = util.initOpenGl(canvas);

	/* Don't need in WebGL2 I believe
	let ext = gl.getExtension('OES_texture_float');
	if(!ext) {
   	alert('Couldnt load!!!');
	}
	gl.getExtension('OES_texture_float_linear');
	*/
	let ext = gl.getExtension('EXT_color_buffer_float');
	if(!ext) {
   	return alert('need EXT_color_buffer_float');
	}

	util.getPrograms(gl, 'label_grid', 'to_mac_grid_pre', 'to_mac_grid', 'add_force', 'enforce_boundary', 'copy').then(programs => {
		startSimulation(canvas, gl, programs);
	});
}


function startSimulation(canvas, gl, programs) {
	let sim = new Simulation(canvas, gl);

	util.resizeToDisplay(gl.canvas);

	/* 
   	Setting up initial position and velocity textures
	*/
	let posData = Float32Array.from(Array(4*sim.NUM_PARTICLES).fill().map(() => Math.random()*0.5));
	//util.bindTexImage2D(gl, gl.TEXTURE0, sim.particlePositions, sim.NUM_PARTICLES, 1, posData);
	util.texImage2D(gl, sim.particlePositions, sim.NUM_PARTICLES, 1, posData);

	//let velData = Float32Array.from(Array(4*sim.NUM_PARTICLES).fill(0));
	let velData = Float32Array.from(Array(4*sim.NUM_PARTICLES).fill().map(() => (Math.random()*2.0)-1.0));
	//util.bindTexImage2D(gl, gl.TEXTURE1, sim.particleVelocities, sim.NUM_PARTICLES, 1, velData);
	util.texImage2D(gl, sim.particleVelocities, sim.NUM_PARTICLES, 1, velData);


	/*
   	Stage 1: Label cells as fluid or air
   */
	let program = programs['label_grid'];
  	let textureSize = Math.ceil(Math.sqrt(sim.GRID_X_SIZE*sim.GRID_Y_SIZE*sim.GRID_Z_SIZE));
  	util.texImage2D(gl, sim.gridLabels, textureSize, textureSize, null);

  	// Create and bind the framebuffer
  	const fb_label = gl.createFramebuffer();
  	gl.bindFramebuffer(gl.FRAMEBUFFER, fb_label);
  	gl.viewport(0, 0, textureSize, textureSize);

	// attach the texture as the first color attachment
	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, sim.gridLabels);

	// Create a vertex array object (attribute state)
	let vao_label_grid = gl.createVertexArray();
	// and make it the one we're currently working with
	gl.bindVertexArray(vao_label_grid);
	util.bufferDataAttribute(gl, program, "a_particle_index", stage_label_grid.data_particleIndices(sim), 1, gl.INT);
	//alert(gl.checkFramebufferStatus(gl.FRAMEBUFFER) + " need:" + gl.FRAMEBUFFER_COMPLETE);
	// Clear the canvas
	//alert(gl.checkFramebufferStatus(fb));
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	// Tell it to use our program (pair of shaders)
	gl.useProgram(program);
	gl.bindVertexArray(vao_label_grid);
	// Textures
	gl.uniform1i(gl.getUniformLocation(program, 'u_particle_position'), 0);
	gl.uniform1i(gl.getUniformLocation(program, 'u_particle_velocity'), 1);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sim.particlePositions);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, sim.particleVelocities);
	// Useful simulation properties
	gl.uniform3i(gl.getUniformLocation(program, "u_gridSize"), sim.GRID_X_SIZE, sim.GRID_Y_SIZE, sim.GRID_Z_SIZE);
	gl.uniform1i(gl.getUniformLocation(program, "u_textureSize"), textureSize);
	gl.drawArrays(gl.POINTS, 0, sim.NUM_PARTICLES);


	/*
		Stage 2: Transfer particle velocities to staggered grid 
	*/
	// Step 1 Compute velocity and weight contributions to grid for each particle
	program = programs['to_mac_grid_pre'];

	const fb_to_mac_grid_pre = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fb_to_mac_grid_pre);
	let gridTextureSize = Math.ceil(Math.sqrt((sim.GRID_X_SIZE+1)*(sim.GRID_Y_SIZE+1)*(sim.GRID_Z_SIZE+1)));
	gl.viewport(0, 0, gridTextureSize, gridTextureSize);

	util.texImage2D(gl, sim.gridVelocitySum, gridTextureSize, gridTextureSize, null);
	util.texImage2D(gl, sim.gridVelocityWeight, gridTextureSize, gridTextureSize, null);

	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, sim.gridVelocitySum);
	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT1, sim.gridVelocityWeight);

	let vao_to_mac_grid_pre = gl.createVertexArray();
	gl.bindVertexArray(vao_to_mac_grid_pre);

	util.bufferDataAttribute(gl, program, "a_particle_index", stage_to_mac_grid.data_particleIndices(sim), 1, gl.INT);
	util.bufferDataAttribute(gl, program, "a_displacement", stage_to_mac_grid.data_displacement(sim), 3, gl.FLOAT, 1);

	gl.blendEquation(gl.FUNC_ADD);

	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);
	gl.drawBuffers([
		gl.COLOR_ATTACHMENT0,
	   gl.COLOR_ATTACHMENT1
	]);

	gl.bindVertexArray(vao_to_mac_grid_pre);
	gl.uniform1i(gl.getUniformLocation(program, 'u_particle_position'), 0);
	gl.uniform1i(gl.getUniformLocation(program, 'u_particle_velocity'), 1);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sim.particlePositions);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, sim.particleVelocities);

	gl.uniform3i(gl.getUniformLocation(program, "u_gridSize"), sim.GRID_X_SIZE, sim.GRID_Y_SIZE, sim.GRID_Z_SIZE);
	gl.uniform3f(gl.getUniformLocation(program, "u_gridStepSize"), sim.GRID_X_STEP, sim.GRID_Y_STEP, sim.GRID_Z_STEP);
	gl.uniform1i(gl.getUniformLocation(program, "u_textureSize"), gridTextureSize);

	gl.drawArraysInstanced(gl.POINTS, 0, sim.NUM_PARTICLES, stage_to_mac_grid.data_displacement(sim).length/3);

	// Step 2 Compute trilinear interpolation to grid by dividing weighted velocity by weight sum
	program = programs['to_mac_grid'];

	const fb_to_mac_grid = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fb_to_mac_grid);
	gl.viewport(0, 0, gridTextureSize, gridTextureSize);

	util.texImage2D(gl, sim.gridVelocity, gridTextureSize, gridTextureSize, null);

	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, sim.gridVelocity);

	let vao_to_mac_grid = gl.createVertexArray();
	gl.bindVertexArray(vao_to_mac_grid);

	util.bufferDataAttribute(gl, program, "a_square_vertex", new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), 2, gl.FLOAT);

	gl.clearColor(0,0,0,0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);

	gl.bindVertexArray(vao_to_mac_grid);
	gl.uniform1i(gl.getUniformLocation(program, 'u_velocity_part'), 0);
	gl.uniform1i(gl.getUniformLocation(program, 'u_divisor_part'), 1);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridVelocitySum);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridVelocityWeight);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	/*
		Stage 3: Add forces by euler integration
	*/
	program = programs['add_force'];

	const fb_add_force = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fb_add_force);
	gl.viewport(0, 0, gridTextureSize, gridTextureSize);

	util.texImage2D(gl, sim.gridVelocityForces, gridTextureSize, gridTextureSize, null);
	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, sim.gridVelocityForces);

	let vao_add_force = gl.createVertexArray();
	gl.bindVertexArray(vao_add_force);

	util.bufferDataAttribute(gl, program, "a_square_vertex", new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), 2, gl.FLOAT);

	gl.clearColor(0,0,0,0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);

	gl.bindVertexArray(vao_add_force);
	gl.uniform3f(gl.getUniformLocation(program, "u_force"), 0.0, 0.0, 1.0);
	gl.uniform1f(gl.getUniformLocation(program, "u_dt"), 0.1);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	/*
		Stage 4: Enforce boundary conditions
	*/
	const fb_enforce_boundary = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fb_enforce_boundary);
	gl.viewport(0, 0, gridTextureSize, gridTextureSize);

	util.texImage2D(gl, sim.gridVelocityBoundary, gridTextureSize, gridTextureSize, null);
	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, sim.gridVelocityBoundary);

	program = programs['enforce_boundary'];
	let vao_enforce_boundary = gl.createVertexArray();
	gl.bindVertexArray(vao_enforce_boundary);
	util.bufferDataAttribute(gl, program, "a_square_vertex", new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), 2, gl.FLOAT);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);
	gl.bindVertexArray(vao_enforce_boundary);
	gl.uniform3i(gl.getUniformLocation(program, "u_gridSize"), sim.GRID_X_SIZE, sim.GRID_Y_SIZE, sim.GRID_Z_SIZE);
	gl.uniform1i(gl.getUniformLocation(program, "u_textureSize"), gridTextureSize);
	gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridVelocityForces);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	/*
		Stage 5: 
	*/
	  

	/*
		Render result to canvas
	*/
	program = programs['copy'];
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

	let vao_show = gl.createVertexArray();
	gl.bindVertexArray(vao_show);

	util.bufferDataAttribute(gl, program, "a_square_vertex", new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), 2, gl.FLOAT);

	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);
	gl.bindVertexArray(vao_show);

	gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridVelocityBoundary);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}


export { initSimulation };
