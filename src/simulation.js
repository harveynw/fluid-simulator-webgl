import * as util from './util';
import { mat4 } from 'gl-matrix';

import Controller from './Controller';
import ComputeStep from './Compute';
import VAO from './VAO';

class Simulation {
	constructor(canvas, gl, particles=1000, gridResolution=[40,40,40]) {
		this.controller = new Controller(canvas);

		this.dt = 0.1;

		this.gravity = [1, 0, -1];

		this.NUM_PARTICLES = particles;
		this.GRID_SIZE = gridResolution;
		this.GRID_X_SIZE = gridResolution[0];
		this.GRID_Y_SIZE = gridResolution[1];
		this.GRID_Z_SIZE = gridResolution[2];

		this.GRID_X_STEP = 1/gridResolution[0];
		this.GRID_Y_STEP = 1/gridResolution[1];
		this.GRID_Z_STEP = 1/gridResolution[2];
		this.GRID_STEP = [
			this.GRID_X_STEP,
			this.GRID_Y_STEP,
			this.GRID_Z_STEP
		];

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

		this.textureSize = Math.ceil(Math.sqrt(this.GRID_X_SIZE*this.GRID_Y_SIZE*this.GRID_Z_SIZE));
		this.gridTextureSize = Math.ceil(Math.sqrt((this.GRID_X_SIZE+1)*(this.GRID_Y_SIZE+1)*(this.GRID_Z_SIZE+1)));

		this.mvpDisplayMatrix = mat4.create();
		this.updateMvpMatrix = this.updateMvpMatrix.bind(this);
	}

	updateMvpMatrix(gl) {
		let projection = mat4.create();
		let modelview = mat4.create();

		mat4.perspective(projection, 1, gl.canvas.clientWidth/gl.canvas.clientHeight, 0.05, 1000);
		mat4.lookAt(modelview, [-4,-4,-1], [0.5,0.5,0], [0,0,1]);
		/* Apply the modeling tranformation to modelview. */
		let translation = [0, 0, 0];
		let degToRad = d => d * Math.PI / 180;
		let rotation = this.controller.viewRotation.map(theta => degToRad(theta));
		let scale = [this.controller.zoom, this.controller.zoom, this.controller.zoom];
		mat4.rotateX(modelview, modelview, rotation[0]);
		mat4.rotateY(modelview, modelview, rotation[1]);
		mat4.rotateZ(modelview, modelview, rotation[2]);
		mat4.scale(modelview, modelview, scale);
		mat4.translate(modelview, modelview, translation);
		/* Multiply the projection matrix times the modelview matrix to give the
		   combined transformation matrix, and send that to the shader program. */
		 
		mat4.multiply(this.mvpDisplayMatrix, projection, modelview);
	}
	
}

function initialPositions(sim) {
	let translate = [0, 0, 0];
	let scale = [sim.GRID_X_STEP, sim.GRID_Y_STEP, sim.GRID_Z_STEP];
	scale = scale.map(sigma => sigma*10);

	let array = [];
	for(let i = 0; i < sim.NUM_PARTICLES; i++) {
		array.push(translate[0] + Math.random() * scale[0]);
		array.push(translate[1] + Math.random() * scale[1]);
		array.push(translate[2] + Math.random() * scale[2]);
		array.push(1);
	}

	return(Float32Array.from(array));
}

function initialVelocities(sim) {
	let scale = [1,1,1];

	let array = [];
	for(let i = 0; i < sim.NUM_PARTICLES; i++) {
		array.push(scale[0] * (Math.random()*2.0 - 1.0));
		array.push(scale[1] * (Math.random()*2.0 - 1.0));
		array.push(scale[2] * (Math.random()*2.0 - 1.0));
		array.push(1);
	}
	return(Float32Array.from(array));
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
		'display_particles',
		'display_boundary'
	).then(programs => {
		let sim = new Simulation(canvas, gl);

		/* 
   			Setting up initial position and velocity textures
		*/
		let posData = initialPositions(sim);
		let velData = initialVelocities(sim);

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
		
		runSimulation(gl, programs, sim);
	});
}

function timestamp() {
	return window.performance && window.performance.now ? window.performance.now() : new Date().getTime();
}

function runSimulation(gl, programs, sim) {
	const textureSize = Math.ceil(Math.sqrt(sim.GRID_X_SIZE*sim.GRID_Y_SIZE*sim.GRID_Z_SIZE));
	const gridTextureSize = Math.ceil(Math.sqrt((sim.GRID_X_SIZE+1)*(sim.GRID_Y_SIZE+1)*(sim.GRID_Z_SIZE+1)));

	/*
		Creating FBO for simulation steps
	*/
	const frameBuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

	const textureDim = [textureSize, textureSize];
	const gridTextureDim = [gridTextureSize, gridTextureSize];
	const particleDim = [sim.NUM_PARTICLES, 1];

	const vao = new VAO(gl, sim);

	let label = new ComputeStep(gl, programs['label_grid'], sim, frameBuffer, vao.PARTICLE_INDEX,
		{ targetTextures: ['gridLabels'], targetDimensions: textureDim});

	let to_mac_grid_pre = new ComputeStep(gl, programs['to_mac_grid_pre'], sim, frameBuffer, vao.MAC_GRID_PRE,
		{ targetTextures: ['gridVelocitySum', 'gridVelocityWeight'], targetDimensions: gridTextureDim}, gl.FUNC_ADD);

	let to_mac_grid = new ComputeStep(gl, programs['to_mac_grid'], sim, frameBuffer, vao.SQUARE_VERTICES,
		{ targetTextures: ['gridVelocity'], targetDimensions: gridTextureDim});

	let add_force = new ComputeStep(gl, programs['add_force'], sim, frameBuffer, vao.SQUARE_VERTICES,
		{ targetTextures: ['gridVelocityForces'], targetDimensions: gridTextureDim});

	let enforce_boundary = new ComputeStep(gl, programs['enforce_boundary'], sim, frameBuffer, vao.SQUARE_VERTICES,
		{ targetTextures: ['gridVelocityBoundary'], targetDimensions: gridTextureDim});

	let divergence = new ComputeStep(gl, programs['divergence'], sim, frameBuffer, vao.SQUARE_VERTICES,
		{ targetTextures: ['gridDivergence'], targetDimensions: textureDim});

	let pressure_iteration = new ComputeStep(gl, programs['pressure_iteration'], sim, frameBuffer, vao.SQUARE_VERTICES,
		{ targetTextures: ['gridPressureCopy'], targetDimensions: textureDim});

	let subtract_gradient = new ComputeStep(gl, programs['subtract_pressure_gradient'], sim, frameBuffer, vao.SQUARE_VERTICES,
		{ targetTextures: ['gridVelocityUpdated'], targetDimensions: gridTextureDim});

	let grid_to_particle = new ComputeStep(gl, programs['grid_to_particle'], sim, frameBuffer, vao.PARTICLE_INDEX,
		{ targetTextures: ['particleVelocitiesCopy'], targetDimensions: particleDim});

	let advection = new ComputeStep(gl, programs['advection'], sim, frameBuffer, vao.PARTICLE_INDEX,
		{ targetTextures: ['particlePositionsCopy'], targetDimensions: particleDim});

	let display = new ComputeStep(gl, programs['copy'], sim, null, vao.SQUARE_VERTICES,
		{ targetTextures: [], targetDimensions: [1000,1000]});

	let displayParticles = new ComputeStep(gl, programs['display_particles'], sim , null, vao.PARTICLE_INDEX,
		{ targetTextures: [], targetDimensions: [1000,1000]});

	let displayBoundary = new ComputeStep(gl, programs['display_boundary'], sim, null, vao.CUBE,
		{ targetTextures: [], targetDimensions: [1000,1000]});

	let last = timestamp();
	
	function step(now) {
		sim.dt = Math.min((now - last) * 1/1000, 1);
		last = now;

		/*
			Stage 1: Label cells as fluid or air
		*/

		label
			.setViewport()
			.setTargetTextures()
			.clearTargets()
			.setupProgram()
			.setUniforms()
			.drawArrays(gl.POINTS, sim.NUM_PARTICLES);

		/*
			Stage 2: Transfer particle velocities to staggered grid 
		*/
		// Step 1 Compute velocity and weight contributions to grid for each particle

		to_mac_grid_pre
			.setViewport()
			.setTargetTextures()
			.clearTargets()
			.setupProgram()
			.setUniforms()
			.drawArraysInstanced(gl.POINTS, sim.NUM_PARTICLES, 5*5*5);

		// Step 2 Compute trilinear interpolation to grid by dividing weighted velocity by weight sum

		to_mac_grid
			.setViewport()
			.setTargetTextures()
			.clearTargets()
			.setupProgram()
			.setUniforms()
			.drawArrays(gl.TRIANGLE_STRIP, 4);

		/*
			Stage 3: Add forces by euler integration
		*/

		add_force
			.setViewport()
			.setTargetTextures()
			.clearTargets()
			.setupProgram()
			.setUniforms()
			.drawArrays(gl.TRIANGLE_STRIP, 4);

		/*
			Stage 4: Enforce boundary conditions
		*/
		
		enforce_boundary
			.setViewport()
			.setTargetTextures()
			.clearTargets()
			.setupProgram()
			.setUniforms()
			.drawArrays(gl.TRIANGLE_STRIP, 4);

		/*
			Stage 5: Computing divergence of velocity grid
		*/

		divergence
			.setViewport()
			.setTargetTextures()
			.clearTargets()
			.setupProgram()
			.setUniforms()
			.drawArrays(gl.TRIANGLE_STRIP, 4);

		/*
			Stage 6: Computing pressure field via Jacobi iterative method for a relatively sparse system
		*/

		pressure_iteration
			.setViewport()
			.setupProgram()
			.setUniforms();

		let texUnit = pressure_iteration.uniforms.find(u => u.value === 'gridPressure').textureUnit;

		for(let iter = 0; iter < 30; iter++) {
			// Binding updated pressure
			gl.activeTexture(texUnit);
			gl.bindTexture(gl.TEXTURE_2D, sim.gridPressure);

			pressure_iteration
				.setTargetTextures()
				.clearTargets()
				.drawArrays(gl.TRIANGLE_STRIP, 4);

			swapTextures(sim, 'gridPressure', 'gridPressureCopy');
		}

		/*
			Stage 7: Subtracting psuedo pressure gradient from velocity field
		*/

		subtract_gradient
			.setViewport()
			.setTargetTextures()
			.clearTargets()
			.setupProgram()
			.setUniforms()
			.drawArrays(gl.TRIANGLE_STRIP, 4);

		/*
			Stage 8: Interpolating new particle velocities TODO PIC/FLIP
		*/

		grid_to_particle
			.setViewport()
			.setTargetTextures()
			.clearTargets()
			.setupProgram()
			.setUniforms()
			.drawArrays(gl.POINTS, sim.NUM_PARTICLES);

		swapTextures(sim, 'particleVelocities', 'particleVelocitiesCopy');

		/*
			Stage 9: Advect particles
		*/

		advection
			.setViewport()
			.setTargetTextures()
			.clearTargets()
			.setupProgram()
			.setUniforms()
			.drawArrays(gl.POINTS, sim.NUM_PARTICLES);
		
		swapTextures(sim, 'particlePositions', 'particlePositionsCopy');

		/*
			Render result to canvas
		*/

		util.resizeToDisplay(gl.canvas);

		let debug = false;

		if(debug) {
			display.targetDimensions = [gl.canvas.width, gl.canvas.height];
			display
				.setViewport()
				.setTargetTextures()
				.clearTargets()
				.setupProgram()
				.setUniforms()
				.drawArrays(gl.TRIANGLE_STRIP, 4);
		} else {
			sim.updateMvpMatrix(gl);

			displayParticles.targetDimensions = [gl.canvas.width, gl.canvas.height];
			displayParticles
				.setViewport()
				.setTargetTextures()
				.clearTargets()
				.setupProgram()
				.setUniforms()
				.drawArrays(gl.POINTS, sim.NUM_PARTICLES);

			let showBoundary = true;

			if(showBoundary) {
				displayBoundary.targetDimensions = [gl.canvas.width, gl.canvas.height];
				displayBoundary
					.setViewport()
					.setTargetTextures()
					.setupProgram()
					.setUniforms()
					.drawArrays(gl.LINES, 12*2); 
			}
		}

		requestAnimationFrame(step);
	}

	requestAnimationFrame(step);
}

function swapTextures(sim, texture1Key, texture2Key) {
	let temp = sim[texture1Key];
	sim[texture1Key] = sim[texture2Key];
	sim[texture2Key] = temp;
}


export { initSimulation };
