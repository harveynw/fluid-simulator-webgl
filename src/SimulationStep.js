class SimulationStep {
	constructor(gl, program, uniforms, attributes, vao,
		{targetTexture, targetDimensions})
	{	
		this.gl;
		this.program = program;
		this.uniforms = uniforms;
		this.attributes = attributes;
		this.vao = vao;

		this.targetTexture = targetTexture;
		this.targetDimensions = targetDimensions;

		storeUniformLocations();
	}

	storeUniformLocations = () => {
		for(const [name, config] of Object.entries(this.uniforms)) {
			const loc = this.gl.getUniformLocation(this.program, name);
			this.uniforms[name]['location'] = loc;
		}
	}

	prepareRender = () => {

	}

	prepareCanvas = () => {
		gl.viewport(0, 0, this.targetDimensions[0],
			this.targetDimensions[1]);

	util.framebufferTexture2D(gl, gl.COLOR_ATTACHMENT0, sim.gridVelocityBoundary);

	program = programs['enforce_boundary'];

	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	}
}

export default SimulationStep;