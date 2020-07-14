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
		this.particlePositions      = gl.createTexture();
		this.particleVelocities     = gl.createTexture();
		this.particlePositionsCopy  = gl.createTexture();
		this.particleVelocitiesCopy = gl.createTexture();

		// Simulation
		this.gridVelocity           = gl.createTexture();
		this.gridVelocitySum        = gl.createTexture();
		this.gridVelocityWeight     = gl.createTexture();

		this.gridVelocityForces     = gl.createTexture();
		this.gridVelocityBoundary   = gl.createTexture();

		// TODO Rename, these aren't really on the MAC grid
		this.gridLabels             = gl.createTexture();
		this.gridDivergence		    = gl.createTexture();

		this.gridPressure           = gl.createTexture();
		this.gridPressureCopy       = gl.createTexture();

		this.gridVelocityUpdated    = gl.createTexture();

		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	}
}

function initSimulation(canvas) {
	const gl = util.initOpenGl(canvas);

	let ext = gl.getExtension('EXT_color_buffer_float');
	if(!ext) {
   		return alert('need EXT_color_buffer_float');
	}

	util.getPrograms(gl,
		'label_grid',
		'to_mac_grid_pre',
		'to_mac_grid',
		'add_force',
		'enforce_boundary',
		'divergence',
		'pressure_iteration',
		'subtract_pressure_gradient',
		'grid_to_particle',
		'advection',
		'copy',
		'display_particles'
	).then(programs => {
		let sim = new Simulation(canvas, gl);

		/* 
   			Setting up initial position and velocity textures
		*/
		let posData = Float32Array.from(Array(4*sim.NUM_PARTICLES).fill().map(() => Math.random()));

		//let velData = Float32Array.from(Array(4*sim.NUM_PARTICLES).fill(0));
		let velData = Float32Array.from(Array(4*sim.NUM_PARTICLES).fill().map(() => (Math.random()*2.0)-1.0));

		/*
			Setting up textures
		*/
		const textureSize = Math.ceil(Math.sqrt(sim.GRID_X_SIZE*sim.GRID_Y_SIZE*sim.GRID_Z_SIZE));
		const gridTextureSize = Math.ceil(Math.sqrt((sim.GRID_X_SIZE+1)*(sim.GRID_Y_SIZE+1)*(sim.GRID_Z_SIZE+1)));

		util.texImage2D(gl, sim.particlePositions, sim.NUM_PARTICLES, 1, posData);
		util.texImage2D(gl, sim.particleVelocities, sim.NUM_PARTICLES, 1, velData);
		util.texImage2D(gl, sim.gridLabels, textureSize, textureSize, null);
		util.texImage2D(gl, sim.gridVelocitySum, gridTextureSize, gridTextureSize, null);
		util.texImage2D(gl, sim.gridVelocityWeight, gridTextureSize, gridTextureSize, null);
		util.texImage2D(gl, sim.gridVelocity, gridTextureSize, gridTextureSize, null);
		util.texImage2D(gl, sim.gridVelocityForces, gridTextureSize, gridTextureSize, null);
		util.texImage2D(gl, sim.gridVelocityBoundary, gridTextureSize, gridTextureSize, null);
		util.texImage2D(gl, sim.gridDivergence, textureSize, textureSize, null);
		util.texImage2D(gl, sim.gridPressure, textureSize, textureSize, null);
		util.texImage2D(gl, sim.gridPressureCopy, textureSize, textureSize, null);
		util.texImage2D(gl, sim.gridVelocityUpdated, gridTextureSize, gridTextureSize, null);
		util.texImage2D(gl, sim.particleVelocitiesCopy, sim.NUM_PARTICLES, 1, null);
		util.texImage2D(gl, sim.particlePositionsCopy, sim.NUM_PARTICLES, 1, null);

		/*
			Setting up VAOs
		*/
		const vao = {}
		vao['particle_index'] = gl.createVertexArray();
		gl.bindVertexArray(vao['particle_index']);
		util.bufferDataAttribute(gl, program, "a_particle_index", stage_label_grid.data_particleIndices(sim), 1, gl.INT);

		const dt = 0.01;
		runSimulation(canvas, gl, programs, sim, dt);
	});
}


function runSimulation(canvas, gl, programs, sim, dt) {
	const textureSize = Math.ceil(Math.sqrt(sim.GRID_X_SIZE*sim.GRID_Y_SIZE*sim.GRID_Z_SIZE));
	const gridTextureSize = Math.ceil(Math.sqrt((sim.GRID_X_SIZE+1)*(sim.GRID_Y_SIZE+1)*(sim.GRID_Z_SIZE+1)));

	/*
		Creating FBO for simulation steps
	*/
	const frameBuffer = gl.createFramebuffer();

	/*
		Stage 1: Label cells as fluid or air
	*/
	let program = programs['label_grid'];
	gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

  	// Create and bind the framebuffer
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

	gl.viewport(0, 0, gridTextureSize, gridTextureSize);

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

	// Clearing framebuffer attachments to prevent issues downstream
	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, null);
	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT1, null);

	// Step 2 Compute trilinear interpolation to grid by dividing weighted velocity by weight sum
	program = programs['to_mac_grid'];

	gl.viewport(0, 0, gridTextureSize, gridTextureSize);

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

	gl.viewport(0, 0, gridTextureSize, gridTextureSize);

	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, sim.gridVelocityForces);

	let vao_add_force = gl.createVertexArray();
	gl.bindVertexArray(vao_add_force);

	util.bufferDataAttribute(gl, program, "a_square_vertex", new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), 2, gl.FLOAT);

	gl.clearColor(0,0,0,0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);

	gl.bindVertexArray(vao_add_force);
	gl.uniform3f(gl.getUniformLocation(program, "u_force"), 0.0, 0.0, 10.0);
	gl.uniform1f(gl.getUniformLocation(program, "u_dt"), dt);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	/*
		Stage 4: Enforce boundary conditions
	*/
	gl.viewport(0, 0, gridTextureSize, gridTextureSize);

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
		Stage 5: Computing divergence of velocity grid
	*/
	gl.viewport(0, 0, textureSize, textureSize);

	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, sim.gridDivergence);

	program = programs['divergence'];
	let vao_divergence = gl.createVertexArray();
	gl.bindVertexArray(vao_divergence);
	util.bufferDataAttribute(gl, program, "a_square_vertex", new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), 2, gl.FLOAT);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);
	gl.bindVertexArray(vao_divergence);
	gl.uniform3i(gl.getUniformLocation(program, "u_gridSize"), sim.GRID_X_SIZE, sim.GRID_Y_SIZE, sim.GRID_Z_SIZE);
	gl.uniform1i(gl.getUniformLocation(program, "u_gridTextureSize"), gridTextureSize);
	gl.uniform1i(gl.getUniformLocation(program, "u_textureSize"), textureSize);
	gl.uniform1i(gl.getUniformLocation(program, 'u_velocity'), 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridVelocityBoundary);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	/*
		Stage 6: Computing pressure field via Jacobi iterative method for a relatively sparse system
	*/
	gl.viewport(0, 0, textureSize, textureSize);

	program = programs['pressure_iteration'];
	let vao_pressure = gl.createVertexArray();
	gl.bindVertexArray(vao_pressure);
	util.bufferDataAttribute(gl, program, "a_square_vertex", new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), 2, gl.FLOAT);
	gl.useProgram(program);
	gl.uniform3i(gl.getUniformLocation(program, "u_gridSize"), sim.GRID_X_SIZE, sim.GRID_Y_SIZE, sim.GRID_Z_SIZE);
	gl.uniform1i(gl.getUniformLocation(program, "u_gridTextureSize"), gridTextureSize);
	gl.uniform1i(gl.getUniformLocation(program, "u_textureSize"), textureSize);

	gl.uniform1i(gl.getUniformLocation(program, 'u_pressure'), 0);

	gl.uniform1i(gl.getUniformLocation(program, 'u_label'), 1);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridLabels);
	gl.uniform1i(gl.getUniformLocation(program, 'u_divergence'), 2);
	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridDivergence);

	for(let iteration = 0; iteration < 30; iteration++) {
		util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, sim.gridPressureCopy);
		// Is the clear not needed because of alpha?
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, sim.gridPressure);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		swapTextures(sim, 'gridPressure', 'gridPressureCopy');
	}

	/*
		Stage 7: Subtracting psuedo pressure gradient from velocity field
	*/
	gl.viewport(0, 0, gridTextureSize, gridTextureSize);

	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, sim.gridVelocityUpdated);

	program = programs['subtract_pressure_gradient'];
	let vao_subtract_pressure_gradient = gl.createVertexArray();
	gl.bindVertexArray(vao_subtract_pressure_gradient);
	util.bufferDataAttribute(gl, program, "a_square_vertex", new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), 2, gl.FLOAT);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);
	gl.bindVertexArray(vao_subtract_pressure_gradient);

	gl.uniform3i(gl.getUniformLocation(program, "u_gridSize"), sim.GRID_X_SIZE, sim.GRID_Y_SIZE, sim.GRID_Z_SIZE);
	gl.uniform1i(gl.getUniformLocation(program, "u_gridTextureSize"), gridTextureSize);
	gl.uniform1i(gl.getUniformLocation(program, "u_textureSize"), textureSize);
	gl.uniform3f(gl.getUniformLocation(program, "u_gridStepSize"), sim.GRID_X_STEP, sim.GRID_Y_STEP, sim.GRID_Z_STEP);
	gl.uniform1f(gl.getUniformLocation(program, "u_dt"), dt);

	gl.uniform1i(gl.getUniformLocation(program, 'u_velocity'), 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridVelocity);
	gl.uniform1i(gl.getUniformLocation(program, 'u_pressure'), 1);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridPressure);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	/*
		Stage 8: Interpolating new particle velocities TODO PIC/FLIP
	*/
	gl.viewport(0, 0, sim.NUM_PARTICLES, 1);

	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, sim.particleVelocitiesCopy);

	program = programs['grid_to_particle'];
	let vao_grid_to_particle = gl.createVertexArray();
	gl.bindVertexArray(vao_grid_to_particle);
	util.bufferDataAttribute(gl, program, "a_particle_index", stage_to_mac_grid.data_particleIndices(sim), 1, gl.INT);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);

	gl.uniform3i(gl.getUniformLocation(program, "u_gridSize"), sim.GRID_X_SIZE, sim.GRID_Y_SIZE, sim.GRID_Z_SIZE);
	gl.uniform3f(gl.getUniformLocation(program, "u_gridStepSize"), sim.GRID_X_STEP, sim.GRID_Y_STEP, sim.GRID_Z_STEP);
	gl.uniform1i(gl.getUniformLocation(program, "u_gridTextureSize"), gridTextureSize);
	gl.uniform1i(gl.getUniformLocation(program, "u_no_particles"), sim.NUM_PARTICLES);

	gl.uniform1i(gl.getUniformLocation(program, 'u_velocity'), 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridVelocity);
	gl.uniform1i(gl.getUniformLocation(program, 'u_particle_position'), 1);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, sim.particlePositions);

	gl.drawArrays(gl.POINTS, 0, sim.NUM_PARTICLES);
	
	swapTextures(sim, 'particleVelocities', 'particleVelocitiesCopy');

	/*
		Stage 9: Advect particles
	*/
	gl.viewport(0, 0, sim.NUM_PARTICLES, 1);

	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, sim.particlePositionsCopy);

	program = programs['advection'];
	let vao_advection = gl.createVertexArray();
	gl.bindVertexArray(vao_advection);
	util.bufferDataAttribute(gl, program, "a_particle_index", stage_to_mac_grid.data_particleIndices(sim), 1, gl.INT);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);

	gl.uniform3i(gl.getUniformLocation(program, "u_gridSize"), sim.GRID_X_SIZE, sim.GRID_Y_SIZE, sim.GRID_Z_SIZE);
	gl.uniform3f(gl.getUniformLocation(program, "u_gridStepSize"), sim.GRID_X_STEP, sim.GRID_Y_STEP, sim.GRID_Z_STEP);
	gl.uniform1i(gl.getUniformLocation(program, "u_gridTextureSize"), gridTextureSize);
	gl.uniform1f(gl.getUniformLocation(program, "u_dt"), dt);
	gl.uniform1i(gl.getUniformLocation(program, "u_no_particles"), sim.NUM_PARTICLES);

	gl.uniform1i(gl.getUniformLocation(program, 'u_velocity'), 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridVelocity);
	gl.uniform1i(gl.getUniformLocation(program, 'u_particle_position'), 1);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, sim.particlePositions);
	gl.uniform1i(gl.getUniformLocation(program, 'u_particle_velocity'), 2);
	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, sim.particleVelocities);
	
	gl.drawArrays(gl.POINTS, 0, sim.NUM_PARTICLES);
	
	swapTextures(sim, 'particlePositions', 'particlePositionsCopy');

	/*
		Render result to canvas
	*/
	canvasShowTexture(gl, programs, sim.gridVelocityBoundary);
	//canvasShowParticles(gl, programs, sim);

	//setTimeout(() => runSimulation(canvas, gl, programs, sim, dt), 500);
	//requestAnimationFrame(() => runSimulation(canvas, gl, programs, sim));
}

function canvasShowTexture(gl, programs, texture) {
	util.resizeToDisplay(gl.canvas);

	let program = programs['copy'];
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
	gl.bindTexture(gl.TEXTURE_2D, texture);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function canvasShowParticles(gl, programs, sim) {
	util.resizeToDisplay(gl.canvas);

	let program = programs['display_particles'];
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

	let vao_show = gl.createVertexArray();
	gl.bindVertexArray(vao_show);
	util.bufferDataAttribute(gl, program, "a_particle_index", stage_to_mac_grid.data_particleIndices(sim), 1, gl.INT);

	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);

	gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_matrix'), false, getModelViewProjectionMatrix(gl, sim.controller));

	gl.uniform1i(gl.getUniformLocation(program, 'u_particle_position'), 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sim.particlePositions);

	gl.drawArrays(gl.POINTS, 0, sim.NUM_PARTICLES);
}

function getModelViewProjectionMatrix(gl, controller) {
	let projection = mat4.create();
    let modelview = mat4.create();
    let modelviewProjection = mat4.create();
    mat4.perspective(projection, 1, gl.canvas.clientWidth/gl.canvas.clientHeight, 0.05, 1000);
    mat4.lookAt(modelview, [-1,-1,1], [0.5,0.5,0.5], [0,0,1]);
    /* Apply the modeling tranformation to modelview. */
    let translation = [0, 0, 0];
    let degToRad = d => d * Math.PI / 180;
    let rotation = controller.viewRotation.map(theta => degToRad(theta));
    let scale = [1, 1, 1];
    mat4.rotateX(modelview, modelview, rotation[0]);
    mat4.rotateY(modelview, modelview, rotation[1]);
    mat4.rotateZ(modelview, modelview, rotation[2]);
    mat4.scale(modelview, modelview, scale);
    mat4.translate(modelview, modelview, translation);
    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
     
    mat4.multiply(modelviewProjection, projection, modelview);
   	return(modelviewProjection);
}

function swapTextures(sim, texture1Key, texture2Key) {
	let temp = sim[texture1Key];
	sim[texture1Key] = sim[texture2Key];
	sim[texture2Key] = temp;
}


export { initSimulation };
