import * as util from './util';
import { mat4 } from 'gl-matrix';
import Controller from './Controller';
import ComputeStep from './Compute';

import * as stage_label_grid from './stages/label_grid';
import * as stage_to_mac_grid from './stages/to_mac_grid';

class Simulation {
	constructor(canvas, gl, particles=100, gridResolution=[40,40,40]) {
		this.controller = new Controller(canvas);

		this.NUM_PARTICLES = 1000;
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

		/*
			Setting up stages
		*/
		runSimulation(gl, programs, vao, sim);
	});
}


function runSimulation(gl, programs, vao, sim) {
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

	let label = new ComputeStep(gl, programs['label_grid'], sim, frameBuffer, vao['particle_index'],
		{ targetTextures: ['gridLabels'], targetDimensions: textureDim});

	let to_mac_grid_pre = new ComputeStep(gl, programs['to_mac_grid_pre'], sim, frameBuffer, vao['mac_grid_pre'],
		{ targetTextures: ['gridVelocitySum', 'gridVelocityWeight'], targetDimensions: gridTextureDim}, gl.FUNC_ADD);

	let to_mac_grid = new ComputeStep(gl, programs['to_mac_grid'], sim, frameBuffer, vao['square_vertices'],
		{ targetTextures: ['gridVelocity'], targetDimensions: gridTextureDim});

	let add_force = new ComputeStep(gl, programs['add_force'], sim, frameBuffer, vao['square_vertices'],
		{ targetTextures: ['gridVelocityForces'], targetDimensions: gridTextureDim});

	let enforce_boundary = new ComputeStep(gl, programs['enforce_boundary'], sim, frameBuffer, vao['square_vertices'],
		{ targetTextures: ['gridVelocityBoundary'], targetDimensions: gridTextureDim});

	let divergence = new ComputeStep(gl, programs['divergence'], sim, frameBuffer, vao['square_vertices'],
		{ targetTextures: ['gridDivergence'], targetDimensions: textureDim});

	let pressure_iteration = new ComputeStep(gl, programs['pressure_iteration'], sim, frameBuffer, vao['square_vertices'],
		{ targetTextures: ['gridPressureCopy'], targetDimensions: textureDim});

	let subtract_gradient = new ComputeStep(gl, programs['subtract_pressure_gradient'], sim, frameBuffer, vao['square_vertices'],
		{ targetTextures: ['gridVelocityUpdated'], targetDimensions: gridTextureDim});

	let grid_to_particle = new ComputeStep(gl, programs['grid_to_particle'], sim, frameBuffer, vao['particle_index'],
		{ targetTextures: ['particleVelocitiesCopy'], targetDimensions: particleDim});

	let advection = new ComputeStep(gl, programs['advection'], sim, frameBuffer, vao['particle_index'],
		{ targetTextures: ['particlePositionsCopy'], targetDimensions: particleDim});

	let display = new ComputeStep(gl, programs['copy'], sim, null, vao['square_vertices'],
		{ targetTextures: [], targetDimensions: [1000,1000]});

	function step() {

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
			.drawArraysInstanced(gl.POINTS, sim.NUM_PARTICLES, stage_to_mac_grid.data_displacement(sim).length/3);

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

		for(let iter = 0; iter < 15; iter++) {
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
		display.targetDimensions = [gl.canvas.width, gl.canvas.height];
		display
			.setViewport()
			.setTargetTextures()
			.clearTargets()
			.setupProgram()
			.setUniforms()
			.drawArrays(gl.TRIANGLE_STRIP, 4);

		//canvasShowParticles(gl, programs, vao, locations, sim);
	}

	let rate = 0.05;
	setTimeout(step, 10000*rate);

	//requestAnimationFrame(() => runSimulation(canvas, gl, programs, vao, sim, locations, dt));
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
