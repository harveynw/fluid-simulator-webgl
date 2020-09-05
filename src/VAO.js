import * as util from './util';

class VAO {
	constructor(gl, sim) {
		let ATTR_PARTICLE_INDICES = new Int32Array([...Array(sim.NUM_PARTICLES).keys()]);
		let ATTR_POSITION_DISPLACEMENT = new Int32Array(this.getDisplacementValues());
		let ATTR_SQUARE_VERTICES = new Int32Array(this.getSquareVertices());

		this.PARTICLE_INDEX = gl.createVertexArray();
		gl.bindVertexArray(this.PARTICLE_INDEX);
		util.bufferDataAttribute(gl, 0, ATTR_PARTICLE_INDICES, 1, gl.INT); // a_particle_index

		this.MAC_GRID_PRE = gl.createVertexArray();
		gl.bindVertexArray(this.MAC_GRID_PRE);
		util.bufferDataAttribute(gl, 0, ATTR_PARTICLE_INDICES, 1, gl.INT); // a_particle_index
		util.bufferDataAttribute(gl, 1, ATTR_POSITION_DISPLACEMENT, 3, gl.FLOAT, 1); // a_displacement

		this.SQUARE_VERTICES = gl.createVertexArray();
		gl.bindVertexArray(this.SQUARE_VERTICES);
		util.bufferDataAttribute(gl, 0, ATTR_SQUARE_VERTICES, 2, gl.FLOAT); // a_square_vertex
	}

	getDisplacementValues() {
		let data = [];

		for(let i = -2; i <= 2; i++) {
			for(let j = -2; j <= 2 ; j++) {
				for(let k = -2; k <= 2; k++) {
					data.push(i);
					data.push(j);
					data.push(k);
				}
			}
		}
		return data;
	}

	getSquareVertices() {
		return [-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0];
	}
}

export default VAO;