import * as util from './util';

/*
	This class abstracts away a lot of the work setting up
	WebGL at each stage of the Simulation
*/


class ComputeStep {

	uniformTextureMappings = {
		'u_particle_position': 'particlePositions',
		'u_particle_velocity': 'particleVelocities',
		'u_velocity_part': 'gridVelocitySum',
		'u_divisor_part': 'gridVelocityWeight',
		'u_velocity': 'gridVelocity',
		'u_velocity_forces': 'gridVelocityForces',
		'u_velocity_boundary': 'gridVelocityBoundary',
		'u_label': 'gridLabels',
		'u_divergence': 'gridDivergence',
		'u_pressure': 'gridPressure',
		'u_velocity_updated': 'gridVelocityUpdated'
	}

	_setUniformMappings = () => {
		this.uniformMappings = {
			'u_dt': {
				'value': 0.1,
				'setter': (l, v) => this.gl.uniform1f(l, v)
			},
			'u_force': {
				'value': [0,0,-10],
				'setter': (l, v) => this.gl.uniform3f(l, v[0], v[1], v[2])
			},
			'u_gridSize': {
				'value': this.sim.GRID_SIZE,
				'setter': (l, v) => this.gl.uniform3f(l, v[0], v[1], v[2])
			},
			'u_gridStepSize': {
				'value': this.sim.GRID_STEP,
				'setter': (l, v) => this.gl.uniform3f(l, v[0], v[1], v[2])
			},
			'u_textureSize': {
				'value': this.sim.textureSize,
				'setter': (l, v) => this.gl.uniform1f(l, v)
			},
			'u_gridTextureSize': {
				'value': this.sim.gridTextureSize,
				'setter': (l, v) => this.gl.uniform1f(l, v)
			},
			'u_no_particles': {
				'value': this.sim.NUM_PARTICLES,
				'setter': (l, v) => this.gl.uniform1f(l, v)
			},
			'u_mvp_matrix': {
				'value': this.sim.mvpDisplayMatrix,
				'setter': (l,v) => this.gl.uniformMatrix4fv(l, false, v),
			}
		};
	}

	constructor(gl, program, sim, frameBuffer, vao,
		{targetTextures, targetDimensions}, blendEquation=null)
	{	
		this.gl = gl;
		this.program = program;
		this.sim = sim;
		this.frameBuffer = frameBuffer;
		this.vao = vao;
		this.blendEquation = blendEquation;

		this.targetTextures = targetTextures;
		this.targetDimensions = targetDimensions;

		this.drawAttachments = [];
		for(const i of targetTextures.keys()) {
			this.drawAttachments.push(gl['COLOR_ATTACHMENT' + i]);
		}

		this.uniforms = [];

		this._setUniformMappings();
		this._storeUniforms();
	}

	drawArrays = (mode, passes) => {
		//console.log("Drawing arrays with mode " + mode + " and " + passes + " passes");
		this.gl.drawArrays(mode, 0, passes);
		this._clearDrawBuffers();
	}

	drawArraysInstanced = (mode, passes, instances) => {
		//console.log("Drawing arrays with mode " + mode + " and " + passes + " passes (" + instances + " instances)");
		this.gl.drawArraysInstanced(mode, 0, passes, instances);
		this._clearDrawBuffers();
	}

	_clearDrawBuffers = () => {
		if(this.targetTextures.length > 1) {
			this.drawAttachments.forEach(attachment => {
				util.framebufferTexture2D(this.gl, attachment, null);
			});
		}
	}

	_storeUniforms = () => {
		let gl = this.gl;

		let textureUnit = 0;
		this._getActiveUniforms().forEach(gl_uniform => {
			let uniform = {};

			if(gl_uniform.type === gl.SAMPLER_2D) {
				let gl_textureUnit = gl['TEXTURE' + textureUnit];
				let currentTextureUnit = textureUnit;

				let setter = (l, v) => {
					gl.uniform1i(l, currentTextureUnit);
					gl.activeTexture(gl_textureUnit);
					gl.bindTexture(gl.TEXTURE_2D, this.sim[v]);
				};

				uniform = {
					'value': this.uniformTextureMappings[gl_uniform.name],
					'setter': setter,
					'textureUnit': gl_textureUnit
				};

				textureUnit++;
			} else {
				uniform = this.uniformMappings[gl_uniform.name];
			}

			uniform['location'] = gl.getUniformLocation(this.program, gl_uniform.name);

			this.uniforms.push(uniform);
		});
	}

	_getActiveUniforms = () => {
		let n = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_UNIFORMS);
		return [...Array(n).keys()].map(i => this.gl.getActiveUniform(this.program, i));
	}

	setViewport = () => {
		let gl = this.gl;

		gl.viewport(0, 0, this.targetDimensions[0], this.targetDimensions[1]);
		if(this.blendEquation !== null) {
			gl.blendEquation(this.blendEquation);
		}

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);

		return this;
	}

	setTargetTextures = () => {
		if(this.drawAttachments.length === 0) return this;

		for(const i of this.targetTextures.keys()) {
			let target = this.sim[this.targetTextures[i]];
			util.framebufferTexture2D(this.gl, this.drawAttachments[i], target);
		}

		this.gl.drawBuffers(this.drawAttachments);

		return this;
	}

	clearTargets = () => {
		this.gl.clearColor(0, 0, 0, 0);
		this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

		return this;
	}

	setupProgram = () => {
		this.gl.useProgram(this.program);
		this.gl.bindVertexArray(this.vao);

		return this;
	}

	setUniforms = () => {
		this.uniforms.forEach(uniform => {
			//console.log("Setting " + uniform.value + " to " + uniform.location);
			uniform.setter(uniform.location, uniform.value);
		});
		
		return this;
	}

}

export default ComputeStep;