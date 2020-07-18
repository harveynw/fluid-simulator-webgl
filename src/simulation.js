import * as util from './util';
import { mat4 } from 'gl-matrix';
import Controller from './controller';

import * as stage_label_grid from './stages/label_grid';
import * as stage_to_mac_grid from './stages/to_mac_grid';

class Simulation {
	constructor(canvas, gl, particles=100, gridResolution=[20,20,20]) {
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

function initialPositions(sim) {
	let array = [];
	for(let x = 0; x < 10; x++) {
		for(let y = 0; y < 10; y++) {
			for(let z = 0; z < 10; z++) {
				array.push(x * sim.GRID_X_STEP * 0.1);
				array.push(y * sim.GRID_Y_STEP * 0.1);
				array.push(1 - (z*sim.GRID_Z_STEP*0.1));
				array.push(1);
			}
		}
	}
	return(Float32Array.from(array));
}

function initSimulation(canvas) {
	const gl = util.initOpenGl(canvas);

	let ext = gl.getExtension('EXT_color_buffer_float');
	if(!ext) {
   		return alert('need EXT_color_buffer_float');
	}

	let locations = {
		'GENERIC_TEXTURE': 1,
		'DT': 2,
		'FORCE': 3,
		'VELOCITY_TEXTURE': 4,
		'PARTICLE_POSITION': 5,
		'PARTICLE_VELOCITY': 6,
		'GRID_SIZE': 7,
		'GRID_STEP_SIZE': 8,
		'GRID_TEXTURE_SIZE': 9,
		'NO_PARTICLES': 10,
		'MVP_MATRIX': 11,
		'LABEL_TEXTURE': 12,
		'TEXTURE_SIZE': 13,
		'PRESSURE_TEXTURE': 14,
		'DIVERGENCE_TEXTURE': 15,
		'VELOCITY_PART': 16,
		'DIVISOR_PART': 17
	};

	util.getPrograms(gl, locations,
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
		let posData = initialPositions(sim);
		//let posData = Float32Array.from(Array(4*sim.NUM_PARTICLES).fill().map(() => Math.random()));

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
		const vao = {};

		vao['particle_index'] = gl.createVertexArray();
		gl.bindVertexArray(vao['particle_index']);
		// a_particle_index
		util.bufferDataAttribute(gl, 0, stage_label_grid.data_particleIndices(sim), 1, gl.INT);

		vao['mac_grid_pre'] = gl.createVertexArray();
		gl.bindVertexArray(vao['mac_grid_pre']);
		// a_particle_index, a_displacement
		util.bufferDataAttribute(gl, 0, stage_to_mac_grid.data_particleIndices(sim), 1, gl.INT);
		util.bufferDataAttribute(gl, 1, stage_to_mac_grid.data_displacement(sim), 3, gl.FLOAT, 1);

		vao['square_vertices'] = gl.createVertexArray();
		gl.bindVertexArray(vao['square_vertices']);
		// a_square_vertex
		util.bufferDataAttribute(gl, 0, new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), 2, gl.FLOAT);

		const dt = 0.1;
		runSimulation(canvas, gl, programs, vao, sim, locations, dt);
	});
}


function runSimulation(canvas, gl, programs, vao, sim, locations, dt) {
	const textureSize = Math.ceil(Math.sqrt(sim.GRID_X_SIZE*sim.GRID_Y_SIZE*sim.GRID_Z_SIZE));
	const gridTextureSize = Math.ceil(Math.sqrt((sim.GRID_X_SIZE+1)*(sim.GRID_Y_SIZE+1)*(sim.GRID_Z_SIZE+1)));

	/*
		Creating FBO for simulation steps
	*/
	const frameBuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

	/*
		Stage 1: Label cells as fluid or air
	*/
	let program = programs['label_grid'];
  	// Create and bind the framebuffer
  	gl.viewport(0, 0, textureSize, textureSize);
	// attach the texture as the first color attachment
	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, sim.gridLabels);

	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);
	gl.bindVertexArray(vao['particle_index']);

	gl.uniform3f(locations['GRID_SIZE'], sim.GRID_X_SIZE, sim.GRID_Y_SIZE, sim.GRID_Z_SIZE);
	gl.uniform1f(locations['TEXTURE_SIZE'], textureSize);

	gl.uniform1i(locations['PARTICLE_POSITION'], 0);
	gl.uniform1i(locations['PARTICLE_VELOCITY'], 1);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sim.particlePositions);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, sim.particleVelocities);

	gl.drawArrays(gl.POINTS, 0, sim.NUM_PARTICLES);

	/*
		Stage 2: Transfer particle velocities to staggered grid 
	*/
	// Step 1 Compute velocity and weight contributions to grid for each particle
	program = programs['to_mac_grid_pre'];

	gl.viewport(0, 0, gridTextureSize, gridTextureSize);

	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, sim.gridVelocitySum);
	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT1, sim.gridVelocityWeight);

	gl.blendEquation(gl.FUNC_ADD);

	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);
	gl.drawBuffers([
		gl.COLOR_ATTACHMENT0,
		gl.COLOR_ATTACHMENT1
	]);
	gl.bindVertexArray(vao['mac_grid_pre']);

	gl.uniform3f(locations['GRID_SIZE'], sim.GRID_X_SIZE, sim.GRID_Y_SIZE, sim.GRID_Z_SIZE);
	gl.uniform3f(locations['GRID_STEP_SIZE'], sim.GRID_X_STEP, sim.GRID_Y_STEP, sim.GRID_Z_STEP);
	gl.uniform1f(locations['GRID_TEXTURE_SIZE'], gridTextureSize);

	gl.uniform1i(locations['PARTICLE_POSITION'], 0);
	gl.uniform1i(locations['PARTICLE_VELOCITY'], 1);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sim.particlePositions);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, sim.particleVelocities);

	gl.drawArraysInstanced(gl.POINTS, 0, sim.NUM_PARTICLES, stage_to_mac_grid.data_displacement(sim).length/3);

	// Clearing framebuffer attachments to prevent issues downstream
	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, null);
	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT1, null);

	// Step 2 Compute trilinear interpolation to grid by dividing weighted velocity by weight sum
	program = programs['to_mac_grid'];

	gl.viewport(0, 0, gridTextureSize, gridTextureSize);

	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, sim.gridVelocity);

	gl.clearColor(0,0,0,0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);
	gl.bindVertexArray(vao['square_vertices']);

	gl.uniform1i(locations['VELOCITY_PART'], 0);
	gl.uniform1i(locations['DIVISOR_PART'], 1);

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

	gl.clearColor(0,0,0,0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);
	gl.bindVertexArray(vao['square_vertices']);

	gl.uniform3f(locations['FORCE'], 0.0, 0.0, -10.0);
	gl.uniform1f(locations['DT'], dt);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	/*
		Stage 4: Enforce boundary conditions
	*/
	gl.viewport(0, 0, gridTextureSize, gridTextureSize);

	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, sim.gridVelocityBoundary);

	program = programs['enforce_boundary'];

	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);
	gl.bindVertexArray(vao['square_vertices']);

	gl.uniform3f(locations['GRID_SIZE'], sim.GRID_X_SIZE, sim.GRID_Y_SIZE, sim.GRID_Z_SIZE);
	gl.uniform1f(locations['GRID_TEXTURE_SIZE'], gridTextureSize);

	gl.uniform1i(locations['GENERIC_TEXTURE'], 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridVelocityForces);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	/*
		Stage 5: Computing divergence of velocity grid
	*/
	gl.viewport(0, 0, textureSize, textureSize);

	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, sim.gridDivergence);

	program = programs['divergence'];

	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);
	gl.bindVertexArray(vao['square_vertices']);

	gl.uniform3i(locations['GRID_SIZE'], sim.GRID_X_SIZE, sim.GRID_Y_SIZE, sim.GRID_Z_SIZE);
	gl.uniform3f(locations['GRID_STEP_SIZE'], sim.GRID_X_STEP, sim.GRID_Y_STEP, sim.GRID_Z_STEP);
	gl.uniform1f(locations['GRID_TEXTURE_SIZE'], gridTextureSize);
	gl.uniform1f(locations['TEXTURE_SIZE'], textureSize);

	gl.uniform1i(locations['VELOCITY_TEXTURE'], 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridVelocityBoundary);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	/*
		Stage 6: Computing pressure field via Jacobi iterative method for a relatively sparse system
	*/
	gl.viewport(0, 0, textureSize, textureSize);

	program = programs['pressure_iteration'];
	gl.useProgram(program);
	gl.bindVertexArray(vao['square_vertices']);

	gl.uniform3f(locations['GRID_SIZE'], sim.GRID_X_SIZE, sim.GRID_Y_SIZE, sim.GRID_Z_SIZE);
	gl.uniform3f(locations['GRID_STEP_SIZE'], sim.GRID_X_STEP, sim.GRID_Y_STEP, sim.GRID_Z_STEP);
	gl.uniform1f(locations['GRID_TEXTURE_SIZE'], gridTextureSize);
	gl.uniform1f(locations['TEXTURE_SIZE'], textureSize);

	gl.uniform1i(locations['PRESSURE_TEXTURE'], 0);

	gl.uniform1i(locations['LABEL_TEXTURE'], 1);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridLabels);
	gl.uniform1i(locations['DIVERGENCE_TEXTURE'], 2);
	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridDivergence);

	for(let iteration = 0; iteration < 15; iteration++) {
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

	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);
	gl.bindVertexArray(vao['square_vertices']);

	gl.uniform3f(locations['GRID_SIZE'], sim.GRID_X_SIZE, sim.GRID_Y_SIZE, sim.GRID_Z_SIZE);
	gl.uniform1f(locations['GRID_TEXTURE_SIZE'], gridTextureSize);
	gl.uniform1f(locations['TEXTURE_SIZE'], textureSize);
	gl.uniform3f(locations['GRID_STEP_SIZE'], sim.GRID_X_STEP, sim.GRID_Y_STEP, sim.GRID_Z_STEP);
	gl.uniform1f(locations['DT'], dt);

	gl.uniform1i(locations['VELOCITY_TEXTURE'], 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridVelocityBoundary);
	gl.uniform1i(locations['PRESSURE_TEXTURE'], 1);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridPressure);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	/*
		Stage 8: Interpolating new particle velocities TODO PIC/FLIP
	*/
	gl.viewport(0, 0, sim.NUM_PARTICLES, 1);

	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, sim.particleVelocitiesCopy);

	program = programs['grid_to_particle'];

	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);
	gl.bindVertexArray(vao['particle_index']);

	gl.uniform3f(locations['GRID_SIZE'], sim.GRID_X_SIZE, sim.GRID_Y_SIZE, sim.GRID_Z_SIZE);
	gl.uniform3f(locations['GRID_STEP_SIZE'], sim.GRID_X_STEP, sim.GRID_Y_STEP, sim.GRID_Z_STEP);
	gl.uniform1f(locations['GRID_TEXTURE_SIZE'], gridTextureSize);
	gl.uniform1f(locations['NO_PARTICLES'], sim.NUM_PARTICLES);

	gl.uniform1i(locations['VELOCITY_TEXTURE'], 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridVelocityUpdated);
	gl.uniform1i(locations['PARTICLE_POSITION'], 1);
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

	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);
	gl.bindVertexArray(vao['particle_index']);

	gl.uniform3f(locations['GRID_SIZE'], sim.GRID_X_SIZE, sim.GRID_Y_SIZE, sim.GRID_Z_SIZE);
	gl.uniform3f(locations['GRID_STEP_SIZE'], sim.GRID_X_STEP, sim.GRID_Y_STEP, sim.GRID_Z_STEP);
	gl.uniform1f(locations['GRID_TEXTURE_SIZE'], gridTextureSize);
	gl.uniform1f(locations['DT'], dt);
	gl.uniform1i(locations['NO_PARTICLES'], sim.NUM_PARTICLES);

	gl.uniform1i(locations['VELOCITY_TEXTURE'], 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sim.gridVelocity);
	gl.uniform1i(locations['PARTICLE_POSITION'], 1);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, sim.particlePositions);
	gl.uniform1i(locations['PARTICLE_VELOCITY'], 2);
	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, sim.particleVelocities);
	
	gl.drawArrays(gl.POINTS, 0, sim.NUM_PARTICLES);
	
	swapTextures(sim, 'particlePositions', 'particlePositionsCopy');

	/*
		Render result to canvas
	*/
	//canvasShowTexture(gl, programs, vao, locations, sim.gridPressure);
	canvasShowParticles(gl, programs, vao, locations, sim);

	let rate = 0.05;
	setTimeout(() => runSimulation(canvas, gl, programs, vao, sim, locations, rate), 10000*rate);

	//requestAnimationFrame(() => runSimulation(canvas, gl, programs, vao, sim, locations, dt));
}

function canvasShowTexture(gl, programs, vao, locations, texture) {
	util.resizeToDisplay(gl.canvas);

	let program = programs['copy'];
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	gl.useProgram(program);
	gl.bindVertexArray(vao['square_vertices']);

	gl.uniform1i(locations['GENERIC_TEXTURE'], 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function canvasShowParticles(gl, programs, vao, locations, sim) {
	util.resizeToDisplay(gl.canvas);

	let program = programs['display_particles'];
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);
	gl.bindVertexArray(vao['particle_index']);

	gl.uniformMatrix4fv(locations['MVP_MATRIX'], false, getModelViewProjectionMatrix(gl, sim.controller));

	gl.uniform1i(locations['PARTICLE_POSITION'], 0);
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
