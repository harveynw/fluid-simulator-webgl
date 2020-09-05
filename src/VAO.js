import * as util from './util';

class VAO {
	constructor(gl, sim) {
		let ATTR_PARTICLE_INDICES = new Int32Array([...Array(sim.NUM_PARTICLES).keys()]);
		let ATTR_POSITION_DISPLACEMENT = new Float32Array(this.getDisplacementValues());
		let ATTR_SQUARE_VERTICES = new Float32Array(this.getSquareVertices());
		let ATTR_CUBE_LINE_VERTICES = new Float32Array(this.getCubeLineVertices());

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

		this.CUBE = gl.createVertexArray();
		gl.bindVertexArray(this.CUBE);
		util.bufferDataAttribute(gl, 0, ATTR_CUBE_LINE_VERTICES, 3, gl.FLOAT); // a_cube_vertex
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

	getCubeLineVertices() {
		let v = [
			[0.0, 0.0, 0.0],
			[1.0, 0.0, 0.0],
			[1.0, 1.0, 0.0],
			[0.0, 1.0, 0.0],
			[0.0, 0.0, 1.0],
			[1.0, 0.0, 1.0],
			[1.0, 1.0, 1.0],
			[0.0, 1.0, 1.0],
		]
		let data = [];
		function connection(i1, i2) {
			data.push(...v[i1]);
			data.push(...v[i2]);
		}

		connection(0,1);
		connection(1,2);
		connection(2,3);
		connection(3,0);

		connection(4,5);
		connection(5,6);
		connection(6,7);
		connection(7,4);

		connection(0,4);
		connection(1,5);
		connection(2,6);
		connection(3,7);

		return data;
	}
}

export default VAO;